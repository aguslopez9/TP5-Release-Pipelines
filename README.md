# TP05 Release Pipelines

Este repo reúne el TP05 completo: app (frontend + backend), workflows de GitHub Actions y scripts para desplegar a QA y Prod usando Render + Netlify.

## ¿Qué hay adentro?

- `frontend/`: app To-Do en vanilla JS. Se conecta a la API leyendo `window.__APP_CONFIG.apiBaseUrl`, valor que el pipeline reemplaza según el entorno.
- `backend/`: API Node que guarda tareas en un `todos.json`. Tiene `/todos` y un `/health` que devuelve `{ status: "ok" }`.
- `scripts/`: utilidades bash que empacan y suben el frontend/backend, además de un health check con 5 reintentos.
- Documentación compartida: este `README.md` aplica a TP5 y TP8; los detalles específicos se registran en `decisiones_tp5.md` y `decisiones_tp8.md`.
- `backend/Dockerfile`: imagen oficial para el TP8. El workflow de CI la construye y publica en GitHub Container Registry (`ghcr.io`), generando tags por commit y manteniendo `latest` sincronizado con `main`.

## Contenedores y registry (TP8)

- Elegimos **GitHub Container Registry** porque ya usamos GitHub Actions y no agrega costos ni credenciales externas. El job `publish_backend_image` (en `ci.yml`) build/pushea `ghcr.io/<owner>/tp5-release-backend`.
- El workflow de Deploy retaguea automáticamente la imagen aprobada como `qa` y `prod` después de cada health check; así mantenemos un historial trazable por commit (`sha`) y los tags estables por ambiente.
- QA usa un servicio de contenedores en Render apuntado al tag `qa`. El paso `Trigger container deploy in Render (QA)` llama a `scripts/deploy_backend_container.sh`, que golpea la API de Render con `QA_RENDER_API_KEY` y `QA_RENDER_SERVICE_ID` para que el servicio (plan gratuito 512 MB RAM / 0.1 vCPU) levante la nueva imagen.
- Prod usa el mismo servicio de Render pero en un Web Service distinto, configurado con plan **Starter** (0.5 vCPU, 2 GB RAM) y autoscaling 1-2 instancias. El pipeline promueve la imagen a `:prod` y dispara el deploy con `PROD_RENDER_API_KEY` / `PROD_RENDER_SERVICE_ID`.
- Para probar localmente la imagen:
  ```bash
  docker build -t tp-backend:dev -f backend/Dockerfile backend
  docker run --rm -p 3000:3000 tp-backend:dev
  ```
- Si necesitás consumir la imagen publicada:
  ```bash
  echo $GITHUB_TOKEN | docker login ghcr.io -u <tu-usuario> --password-stdin
  docker pull ghcr.io/<owner>/tp5-release-backend:qa
  ```

### Variables y secretos para QA

- `QA_RENDER_API_KEY` (secret): token personal de Render con scope “Deploy + Services”.
- `QA_RENDER_SERVICE_ID` (var): ID del servicio Docker en Render (obtiene URL pública `https://<service>.onrender.com` que usamos como `QA_BACKEND_URL`).
- `QA_RENDER_REGION` (var, opcional): lo usamos solo como metadata en logs.
- `QA_FRONTEND_*` y `QA_BACKEND_*`: siguen siendo los tokens/IDs de Netlify y Render clásicos para el frontend estático, por lo que QA queda con frontend Netlify + backend Render contenedorizado.

### Variables y secretos para Prod

- `PROD_RENDER_API_KEY` (secret) y `PROD_RENDER_SERVICE_ID` (var): apuntan al servicio Render configurado con plan Starter, auto deploy disabled (solo Actions) y escala 1-2 instancias.
- `PROD_BACKEND_URL` y `PROD_HEALTHCHECK_URL`: URLs públicas expuestas por Render para validar el contenedor en producción.
- `PROD_FRONTEND_*`: siguen controlando el deploy del frontend estático a Netlify (plan Pro), de modo que ambos ambientes tienen front separado pero backend containerizado.

### QA vs Prod

| Aspecto | QA | Prod |
| --- | --- | --- |
| Hosting contenedor | Render Free (0.1 vCPU / 512 MB) | Render Starter (0.5 vCPU / 2 GB) |
| Imagen | `ghcr.io/...:qa` | `ghcr.io/...:prod` |
| Escala | 1 instancia | 1-2 instancias (autoscale) |
| Deploy trigger | Cada run exitoso de Actions | Gate manual + deploy desde Actions |
| Frontend | Netlify QA site | Netlify Prod site |

Ambos servicios viven en regiones separadas (`QA_RENDER_REGION`, `PROD_RENDER_REGION`) y usan secrets distintos para reforzar la segregación de ambientes.

## Pipeline CI/CD completo

- **Build + Test**: `ci.yml` corre en pushes/PRs a `main`, lint + tests del backend (`npm ci`, `npm run lint`, `npm test`) y validación del frontend (`node --check`). Los artefactos `frontend-dist` y `backend-dist` quedan publicados para los deploys.
- **Dockerizado**: job `publish_backend_image` (solo en pushes) construye una imagen optimizada multi-stage (`backend/Dockerfile`), la taggea con el SHA y, si es `main`, con `latest`. Se publica en GHCR usando `docker/build-push-action`.
- **Deploy QA**: `deploy.yml` se dispara con `workflow_run` cuando CI termina bien en `main`. QA job descarga artefactos, redeploya frontend a Netlify y backend en Render via API usando el tag `:qa`. El health check actúa como quality gate.
- **Gate + Deploy Prod**: Prod job depende de QA, además de requerir aprobación manual del environment `prod` en GitHub. Solo entonces promueve la imagen a `:prod`, redeploya en Render (plan Starter, autoscaling 1-2 instancias) y actualiza el frontend de producción.
- **Quality Gates**: 
  - QA debe pasar health check para que la job termine “success”.
  - `deploy_prod` tiene `needs.deploy_qa.result == 'success'` y, al usar `environment: prod`, requiere aprobación humana antes de usar `PROD_*` secrets.
  - Solo runs en `main` pueden desplegar (condición adicional en ambos jobs).

Este flujo cumple lo pedido en la consigna: build/test automáticos, construcción y push de imágenes versionadas, deploy continuo a QA/Prod con gating y aprobaciones manuales entre ambientes.

## Workflows de GitHub Actions

- **CI (`.github/workflows/ci.yml`)**  
  Se ejecuta en cada push/PR a `main`. Valida el frontend con `node --check`, corre `npm test` en el backend y publica los artefactos `frontend-dist` y `backend-dist`.

- **Deploy (`.github/workflows/deploy.yml`)**  
  Arranca solo si el CI fue exitoso. Tiene dos stages:
  1. `deploy_qa`: baja los artefactos, reemplaza `frontend/config.js` con `QA_BACKEND_URL`, despliega con los scripts y pasa el `health_check.sh`.
  2. `deploy_prod`: espera aprobación manual (environment `prod`), repite el despliegue con variables/productivas y corre otro health check.

Cada entorno usa sus secrets (`*_TOKEN`) y vars (`*_URL`, `*_DEPLOY_ENDPOINT`, etc.) definidos en **GitHub → Settings → Environments**.

## Runbook express

1. Hacés cambios y pusheás a `main` → se corre CI.
2. Si CI pasa, empieza Deploy: QA se publica solo.
3. Revisás la ejecución, aprobás el environment `prod` desde Actions.
4. Prod se despliega y ejecuta su health check.

## ¿Cómo levantarlo local?

```bash
# Backend
cd backend
npm install
npm start  # escucha en el puerto 3000 o el que ponga PORT

# Frontend
# Servilo estático (por ejemplo con Live Server). Editá frontend/config.js si querés pegarle a otro backend local.
```

## Rollbacks y evidencias

- Si algo sale mal, podés re-ejecutar un run anterior del workflow `Deploy` o usar el historial de Netlify/Render.
- Para la defensa hay que guardar capturas de: configuración de environments, runs exitosos, health checks y las URLs QA/Prod en funcionamiento.


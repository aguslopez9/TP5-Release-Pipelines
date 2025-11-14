# TP05 Release Pipelines

Este repo reúne el TP05 completo: app (frontend + backend), workflows de GitHub Actions y scripts para desplegar a QA y Prod usando Render + Netlify.

## ¿Qué hay adentro?

- `frontend/`: app To-Do en vanilla JS. Se conecta a la API leyendo `window.__APP_CONFIG.apiBaseUrl`, valor que el pipeline reemplaza según el entorno.
- `backend/`: API Node que guarda tareas en un `todos.json`. Tiene `/todos` y un `/health` que devuelve `{ status: "ok" }`.
- `scripts/`: utilidades bash que empacan y suben el frontend/backend, además de un health check con 5 reintentos.

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


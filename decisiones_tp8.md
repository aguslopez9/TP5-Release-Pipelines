# Diario de laburo – TP08 (en progreso)

## ¿Cuál es el objetivo?
TP08 exige contenerizar la aplicación, publicar las imágenes en un registry y mantener un pipeline que pueda explicar cada decisión. Vamos a iterar sobre el repo de TP5 para evitar duplicar código y llegar más rápido al TP integrador.

## Decisión 1 – Container Registry
- **Servicio elegido**: GitHub Container Registry (`ghcr.io`). Razones: ya usamos GitHub Actions, no agrega costos y respeta los permisos del repo. Evitamos credenciales extra y mantenemos todo dentro del mismo proveedor gratuito.
- **Escenario evaluado**: Docker Hub (gratuito, pero implicaba manejar tokens propios y rate limits). Lo descartamos porque GHCR se integra con `GITHUB_TOKEN` y simplifica la gobernanza.
- **Scope inicial**: contenerizamos el backend (Node nativo). El frontend sigue desplegándose estático, pero más adelante podemos replicar el patrón cuando lo necesitemos en un servicio de contenedores.

## Decisión 2 – Integración en el pipeline
- Agregamos un Dockerfile oficial en `backend/Dockerfile` (multi-stage sobre `node:20-alpine`, instala dependencias con `npm ci --omit=dev` y expone el puerto 3000).
- El job nuevo `publish_backend_image` dentro de `ci.yml` construye la imagen solo en pushes a `main` y la publica en `ghcr.io/<owner>/tp5-release-backend` con tags `sha` + `latest`.
- `deploy.yml` ahora retaguea la imagen aprobada como `qa` y `prod` después de cada health check; esto deja audit trail por commit (`sha`) pero también tags estables por ambiente para cualquier consumidor externo.
- El mismo pipeline sigue haciendo deploy tradicional a Render/Netlify para no romper el TP5; en paralelo ya tenemos las imágenes listas para mover a un hosting de contenedores gratis (Render, Railway) cuando avancemos el entregable.

## Decisión 3 – Deploy QA en servicio de contenedores
- **Servicio**: Render Web Service configurado como “Deploy an existing Docker image” apuntando a `ghcr.io/<owner>/tp5-release-backend:qa`. Razones: tiene free tier, soporta Docker, expone HTTPS público y ya usábamos Render, así que reaprovechamos networking y monitoreo.
- **Automatización**: reemplazamos el paso `deploy_backend.sh` en QA por `scripts/deploy_backend_container.sh`, que llama a la API de Render (`/v1/services/<id>/deploys`) con `QA_RENDER_API_KEY` y el tag `qa`. Después corremos el `health_check.sh` sobre la URL pública para validar que el contenedor levantó.
- **Variables y secretos**: `QA_RENDER_API_KEY` (secret en GitHub Env), `QA_RENDER_SERVICE_ID` y `QA_RENDER_REGION` (vars). La URL resultante se publica como `QA_BACKEND_URL`, lo que además alimenta el frontend Netlify y los health checks.
- **Recursos**: Render free tier (0.1 vCPU / 512 MB RAM) alcanza para testing; dejamos anotado que se puede subir al plan Starter si la defensa requiere más carga.

## Decisión 4 – Deploy Prod con configuración distinta
- **Servicio**: También Render Web Service, pero en otro servicio aislado configurado con plan Starter (0.5 vCPU, 2 GB RAM) y autoscaling 1-2 instancias. Mantener el mismo proveedor simplifica la operatoria, pero la diferencia de plan/escala cumple con la segregación que pide el TP.
- **Automatización**: `deploy.yml` promueve la imagen aprobada a `:prod` y ejecuta `scripts/deploy_backend_container.sh` con `PROD_RENDER_API_KEY` / `PROD_RENDER_SERVICE_ID`. `autoDeploy` en Render está desactivado para Prod, de modo que únicamente los runs aprobados desde GitHub Actions pueden empujar una imagen.
- **Recursos / HA**: la capacidad extra (0.5 vCPU y 2 GB) + autoscaling 1→2 instancias brinda redundancia básica. Documentamos que, ante mayor demanda, Render permite subir a plan Pro o habilitar múltiples instancias permanentes; el pipeline no necesita cambios.
- **Diferencias documentadas**: README incluye una tabla QA vs Prod (hosting, imagen, escala, gating) y `decisiones_tp8.md` explica el porqué de cada ajuste. Los secrets/vars (`PROD_RENDER_*`, `PROD_BACKEND_URL`) viven en el environment `prod` con aprobación manual para preservar la segregación.

## Decisión 5 – Pipeline CI/CD completo
- **Herramienta**: GitHub Actions para todo el ciclo (CI + CD). Aprovechamos que ya estaba configurado en TP5 y lo extendimos con jobs de Docker y despliegue a contenedores.
- **CI**: `ci.yml` contiene dos jobs (frontend/backend). El backend ejecuta lint + tests, el frontend valida sintaxis. Ambos publican artefactos. Un tercer job (`publish_backend_image`) construye la imagen multi-stage y la sube a GHCR con tags `sha` + `latest`.
- **CD**: `deploy.yml` se ejecuta vía `workflow_run` al finalizar CI en `main`. QA descarga artefactos, actualiza frontend y manda el backend a Render usando el tag `:qa`, seguido de health check (quality gate). Prod depende de QA, requiere aprobación manual del environment y, recién ahí, promueve la imagen a `:prod`, redeploya Render plan Starter y actualiza frontend.
- **Gates y segregación**: 
  - Deploys solo ocurren si la rama es `main` y el CI concluyó `success`.
  - QA debe pasar health check para habilitar Prod (`needs.deploy_qa.result`).
  - Prod exige aprobación humana gracias al environment `prod` en GitHub (mantiene secrets aislados).
  - Health checks + autoscaling en Render aportan la “quality gate” técnica y la capacidad de recuperar si falla.
- Este pipeline cubre los requisitos del TP8: build/test automáticos, imágenes Docker optimizadas, push versionado al registry, deploy continuo a QA/Prod y aprobaciones manuales entre ambientes.

## Sección 1 – Decisiones Arquitectónicas (modo historia)

- **Stack**: seguimos con Node “pelado” para el backend y frontend vanilla. La idea es no meter frameworks pesados que sumen build steps raros; todo corre con Node 20 y archivos estáticos así que el pipeline es más liviano y los contenedores arrancan en segundos.
- **Registry (GHCR)**: elegimos GitHub Container Registry porque vivimos en GitHub. No tuve que generar credenciales nuevas ni preocuparme por rate limits locos; con el `GITHUB_TOKEN` ya puedo loguearme, pushear y controlar permisos por repo. Docker Hub era plan B, pero GHCR me ahorra un dashboard extra y sigue siendo gratis.
- **Hosting (Render + Netlify)**: Render me deja subir una imagen Docker y me expone HTTPS sin romperme la cabeza, encima tiene tier gratis para QA. Netlify sigue resolviendo el frontend estático con la misma simplicidad que en TP5. De esa forma no pago Azure y puedo justificar que prioricé servicios sin costo pero con features de prod como health checks y logs.
- **CI/CD (GitHub Actions)**: mantener todo en el mismo repo me simplifica muchísimo. Usé Actions porque ya teníamos workflows andando, los secrets están ordenados por environment y la integración con GHCR es directa. Configurar Jenkins/GitLab hubiera sido más overhead solo para cumplir la consigna.
- **QA vs Prod en Render**: uso el mismo proveedor para no duplicar aprendizaje, pero cada ambiente vive en un servicio distinto: QA está en el free plan (0.1 vCPU / 512 MB, 1 instancia) y Prod en Starter (0.5 vCPU / 2 GB) con autoscaling 1→2 instancias. Secrets separados (`QA_RENDER_*` vs `PROD_RENDER_*`), approvals distintos y regiones/configs independientes. Si en algún momento necesito algo más potente en Prod puedo escalar el plan sin cambiar pipeline.
- **Recursos**:
  - QA: Render Free. Es más que suficiente para correr la API de tareas y hacer smoke tests. Limitélo a una instancia para evitar sorpresas.
  - Prod: Render Starter con dos instancias máximas. Ya con eso puedo bancar tráfico de demo y, si se rompe una instancia, la otra sigue respondiendo. La memoria extra también ayuda a que Node no se quede corto.

## Sección 2 – Implementación (qué mostrar en el documento)

### Container Registry (GHCR)
- **Evidencia**: screenshot de `https://github.com/<owner>/<repo>/packages` mostrando el paquete `tp5-release-backend` con tags `latest`, `sha-xxxxx`, `qa`, `prod`.
- **Autenticación**: usamos el `GITHUB_TOKEN` provisto por Actions en `docker/login-action`. En una demo manual se puede mostrar `echo $PAT | docker login ghcr.io -u <user> --password-stdin`. Los permisos se heredan del repo; opcionalmente se puede dejar el paquete público para la defensa.

### Ambiente QA (Render Free + Netlify QA)
- **Deploy funcionando**: captura del dashboard de Render (`Service → Events`) mostrando el deploy gatillado por Actions, más la URL `https://<service-qa>.onrender.com/health` respondiendo `{"status":"ok"}`.
- **Variables/secretos**: screenshot de GitHub → Settings → Environments → `qa`, donde se vean `QA_RENDER_API_KEY`, `QA_RENDER_SERVICE_ID`, `QA_RENDER_REGION`, `QA_FRONTEND_*`. Opcional: captura del panel de Render con `Environment Variables`.
- **Recursos**: mostrar el plan Free (0.1 vCPU / 512 MB) en el panel de Render y que `Instances` = 1. Dejar anotado que es single instance sin autoscaling.

### Ambiente Prod (Render Starter + Netlify Prod)
- **Deploy funcionando**: screenshot del servicio Prod en Render con los eventos recientes + URL `https://<service-prod>.onrender.com/health`. También conviene mostrar la aprobación manual en GitHub Actions antes del deploy.
- **Recursos y escalabilidad**: captura del plan Starter (0.5 vCPU / 2 GB) con autoscaling 1-2 instancias. Señalar que el servicio tiene `Auto deploy` en “No” (solo via API) y `Instance Count` mínimo 1 / máximo 2.
- **Continuous deployment**: citar el paso `Trigger container deploy in Render (Prod)` en `deploy.yml` y la tabla de tags (`qa` vs `prod`). Explicar que la promoción de imagen + llamada a la API es el mecanismo de CD.
- **Diferencias con QA**: enfatizar en la documentación que Prod tiene plan pago, autoscaling, approvals manuales y secrets distintos; QA es free tier sin autoscaling ni approval.

### Pipeline CI/CD (GitHub Actions)
- **Ejecución**: capturas del workflow `CI` mostrando los jobs `Build Frontend`, `Build Backend`, `Package backend image`. Otra captura del workflow `Deploy` con las etapas `Deploy QA` y `Deploy Prod`.
- **Stages**:
  1. Build/test frontend/backend (logs de lint/test).
  2. Build/push imagen Docker (salida de `docker/build-push-action` con tags).
  3. Deploy QA: evidencia del health check y de la llamada a Render.
  4. Approval gate: screenshot del environment `prod` esperando aprobación.
  5. Deploy Prod: logs del script de Render + health check final.

Con estas evidencias en el PDF/Markdown se cubre la Sección 2 completa sin necesidad de modificar código.

## Pendientes abiertos
- Incorporar hosting 100 % container-based (Render Docker/Render Blueprint o Railway) para cerrar el circuito completo en QA/Prod.
- Definir cómo versionar la imagen del frontend (¿nginx + env injection o servercito Node?).
- Documentar costos/limitaciones de cada proveedor alternativo.
- Preparar demos y capturas para la defensa oral.

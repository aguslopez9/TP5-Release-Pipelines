# TP5-Release-Pipelines

Pipeline de CI/CD para el TP05 de DevOps empleando únicamente GitHub Actions más servicios cloud externos (sin Azure DevOps).

## Aplicación
- `frontend/`: SPA en HTML/CSS/JS que consume la API vía `window.__APP_CONFIG.apiBaseUrl`.
- `backend/`: API REST en Node.js nativo (`http` + persistencia en `backend/data/todos.json`) con endpoint de health check en `/health`.
- `scripts/`: utilidades reutilizadas por los workflows para desplegar (`deploy_frontend.sh`, `deploy_backend.sh`) y validar (`health_check.sh`).

## Workflows de GitHub Actions

### CI (`.github/workflows/ci.yml`)
- Se ejecuta en `push` y `pull_request` contra `main`.
- `build_frontend`: valida sintaxis de los archivos JS y publica el contenido completo del frontend como artefacto `frontend-dist`.
- `build_backend`: instala dependencias, ejecuta `npm test` (lint sintáctico) y publica el backend como artefacto `backend-dist`.
- Los artefactos quedan disponibles para el workflow de despliegue.

### Release (`.github/workflows/deploy.yml`)
- Se dispara automáticamente cuando `CI` finaliza con éxito (`workflow_run`).
- `deploy_qa` (environment `qa`):
  - Descarga los artefactos de la última ejecución de `CI`.
  - Inyecta la `apiBaseUrl` correspondiente a QA.
  - Ejecuta los scripts de despliegue usando secretos/variables del environment.
  - Corre el health check con `scripts/health_check.sh`.
- `deploy_prod` (environment `prod`):
  - Necesita aprobación manual configurada en `Settings → Environments → prod`.
  - Replica los pasos de QA con variables productivas y un health check final.
- Ambos jobs consumen endpoints HTTP genéricos, por lo que se puede usar Render, Railway, Fly.io, Vercel, Netlify, etc.

## Variables y secretos por entorno

Configurar en cada environment (`qa`, `prod`) los siguientes valores:

| Tipo | Nombre | Descripción |
|------|--------|-------------|
| Secret | `QA_BACKEND_TOKEN` / `PROD_BACKEND_TOKEN` | Token para autenticar el deploy del backend. |
| Secret | `QA_FRONTEND_TOKEN` / `PROD_FRONTEND_TOKEN` | Token para el deploy del frontend. |
| Secret (opcional) | `QA_HEALTHCHECK_URL` / `PROD_HEALTHCHECK_URL` | URL completa del health check si difiere de `<BACKEND_URL>/health`. |
| Variable | `QA_BACKEND_URL` / `PROD_BACKEND_URL` | URL pública de la API en cada entorno. |
| Variable | `QA_BACKEND_SERVICE_ID` / `PROD_BACKEND_SERVICE_ID` | Identificador del servicio backend en el proveedor elegido. |
| Variable | `QA_BACKEND_DEPLOY_ENDPOINT` / `PROD_BACKEND_DEPLOY_ENDPOINT` | Endpoint HTTP que recibe el zip del backend. |
| Variable | `QA_FRONTEND_SITE_ID` / `PROD_FRONTEND_SITE_ID` | Id/Site name del host del frontend. |
| Variable | `QA_FRONTEND_DEPLOY_ENDPOINT` / `PROD_FRONTEND_DEPLOY_ENDPOINT` | Endpoint HTTP para desplegar el frontend. |

> Los scripts aceptan estos valores como variables de entorno. Si la plataforma elegida utiliza CLI propia, se puede adaptar el script sin modificar los workflows.

## Rollback y evidencias
- GitHub Actions conserva la historia de artefactos; es posible relanzar un despliegue seleccionando una ejecución previa.
- Los proveedores (Render/Vercel/etc.) suelen permitir rollbacks nativos; documentar la estrategia elegida en `decisiones.md`.
- Guardar capturas de:
  - Configuración de environments (variables, reviewers).
  - Ejecuciones exitosas de `CI` y `Deploy`.
  - Resultado del health check en QA/Prod.
  - Sitios desplegados en ambos entornos.

## Desarrollo local
```bash
# backend
cd backend
npm install
npm start

# frontend (sirve estático con live server o similar)
```
Actualizar `frontend/config.js` solo para testing local; en los despliegues el workflow lo reescribe según el entorno.

## Scripts disponibles
- `scripts/deploy_frontend.sh <env>`: empaqueta `frontend/` y llama al endpoint remoto con autenticación.
- `scripts/deploy_backend.sh <env>`: idem para `backend/`.
- `scripts/health_check.sh <url>`: reintenta hasta 5 veces con intervalos de 5s.

## Uso de IA
Se utilizaron asistentes (ChatGPT/Copilot) para redactar workflows y documentación. Cada fragmento fue revisado y ejecutado localmente/mentalmente para garantizar sintaxis correcta y coherencia con los requisitos del TP5 descritos en la guía oficial ([Guía TP05](https://raw.githubusercontent.com/ingsoft3ucc/TPs_2025/main/trabajos/05-ado-release-pipelines.md)).

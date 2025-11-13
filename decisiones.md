# Decisiones Técnicas – TP05 Release Pipelines con GitHub

## 1. Objetivo y enfoque
- Migrar el TP05 a un flujo CI/CD basado al 100 % en GitHub (Actions + Environments), cumpliendo con la guía oficial del trabajo práctico sin recurrir a Azure DevOps.
- Automatizar build, empaquetado y despliegue para dos entornos (`qa` y `prod`) con aprobaciones manuales, configuración por ambiente y health checks posteriores.

## 2. Arquitectura de la solución
- **Repositorio monorepo**: `frontend/` (SPA estática) + `backend/` (API Node.js) + `scripts/`.
- **Workflows**:
  - `CI` compila/valida y publica artefactos (`frontend-dist`, `backend-dist`).
  - `Deploy` consume esos artefactos; despliega primero QA y luego Prod (con gate manual).
- **Scripts reutilizables** (`scripts/*.sh`) encapsulan la lógica de despliegue para que los workflows solo expongan variables/secretos.

## 3. Servicios cloud elegidos

| Componente | QA | PROD | Motivo |
|------------|----|------|--------|
| Frontend | Netlify (site `tp5-qa`) | Netlify (site `tp5-prod`) | Hosting estático con CLI/endpoint HTTP para deploys automatizables. |
| Backend | Render (service `tp5-api-qa`) | Render (service `tp5-api-prod`) | Despliegue Node gestionado, health check configurable, rollback sencillo. |
| Base de datos | Render Disk + `todos.json` | Render Disk + snapshot | Datos simples persistidos en disco administrado. |

> Los scripts usan endpoints genéricos (`*_DEPLOY_ENDPOINT`) para no acoplarse a un proveedor. Si se decide cambiar de plataforma solo hay que actualizar los endpoints y tokens en los environments de GitHub.

## 4. Workflow de CI (`.github/workflows/ci.yml`)
- **Triggers**: `push` y `pull_request` a `main`.
- **Jobs**:
  - `build_frontend`: `node --check` sobre `app.js`/`config.js` + publicación de artefacto.
  - `build_backend`: `npm ci`, `npm run lint`, `npm test`, publicación de artefacto.
- **Artefactos**: se sube la carpeta completa para que el workflow de Deploy la reutilice sin volver a compilar.

## 5. Workflow de CD (`.github/workflows/deploy.yml`)
- **Trigger**: `workflow_run` → se ejecuta únicamente cuando `CI` termina en estado `success`.
- **Job `deploy_qa`**:
  - Descarga artefactos del run de CI que disparó el workflow (usando `dawidd6/action-download-artifact`).
  - Sobrescribe `frontend/config.js` con `QA_BACKEND_URL`.
  - Ejecuta `deploy_frontend.sh qa` y `deploy_backend.sh qa` con los secretos/variables del environment `qa`.
  - Lanza `health_check.sh` apuntando a `QA_HEALTHCHECK_URL` (o `<QA_BACKEND_URL>/health`).
- **Job `deploy_prod`**:
  - Depende de QA y se ejecuta en el environment `prod`.
  - Requiere aprobación manual (reviewers definidos en `Settings → Environments → prod`).
  - Replica los pasos de QA con valores productivos y un health check final.

## 6. Gestión de configuración sensible
- **Environments**: `qa` y `prod` tienen secretos aislados; los reviewers solo aprueban Prod.
- **Secrets**: tokens de autenticación (`*_TOKEN`) y endpoints protegidos.
- **Variables (`vars`)**: IDs públicos, URLs y parámetros de despliegue menos sensibles.
- **Inyección de config**: los scripts reciben variables a través de `env` y validan su presencia (`set -euo pipefail`).

## 7. Estrategia de health check
- Endpoint estándar `/health` en el backend (`server.js`) retornando `{ status: "ok" }`.
- Script `health_check.sh` realiza 5 intentos con backoff fijo (5 s) y falla el job si no obtiene `HTTP 200`.
- Posibilidad de apuntar a un endpoint distinto por entorno mediante `QA_HEALTHCHECK_URL` / `PROD_HEALTHCHECK_URL`.

## 8. Rollback
- **GitHub Actions**: se puede re-ejecutar el workflow `Deploy` de una ejecución previa para redeployar artefactos conocidos.
- **Render / Netlify**: ambos guardan historial de releases → rollback manual inmediato desde la UI en caso de urgencia.
- Documentar en la defensa que el rollback recomendado es: “aprobar” un run previo en Actions o presionar “rollback” en el proveedor según la criticidad.

## 9. Evidencias planificadas
- Capturas de:
  - Configuración de environments (variables, secretos, reviewers).
  - Runs exitosos de `CI` y `Deploy` (QA + Prod).
  - Health check OK en ambos entornos.
  - Aplicación corriendo en URLs QA y Prod.
- Incluirlas en una carpeta `/evidencias` o en el documento compartido (link en README).

## 10. Defensa oral – puntos clave
- Justificar elección de GitHub Actions (pipeline-as-code, integración con repo, environments con approvals) en relación con la guía oficial ([Guía TP05](https://raw.githubusercontent.com/ingsoft3ucc/TPs_2025/main/trabajos/05-ado-release-pipelines.md)).
- Explicar cómo se separan responsabilidades entre CI y CD.
- Demostrar manejo de secretos/variables y estrategia de rollback.
- Mencionar validaciones automáticas (lint/test + health check) y su impacto en la calidad.

## 11. Uso de IA
- ChatGPT/Copilot asistieron en la redacción de workflows, scripts y documentación.
- Validaciones manuales: revisión de sintaxis YAML, pruebas locales de los scripts y simulaciones de flujos en GitHub Actions.
- Se dejará constancia en la defensa de qué fragmentos fueron generados y cómo se verificaron para cumplir con la política del TP.
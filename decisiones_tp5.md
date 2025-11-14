# Diario de laburo – TP05 Release Pipelines

## ¿Por qué hicimos todo esto?
La consigna del TP pedía armar un pipeline que pase por QA y Prod, con aprobaciones, health checks y todo eso, pero sin usar Azure DevOps. Decidimos hacerlo 100 % con GitHub Actions, guardando la app (frontend + backend) y los scripts de deploy en este repo.

## Paso a paso de lo que fuimos armando

1. **Arrancamos con la app**  
   - `frontend/`: HTML/CSS/JS sencillos, configurable vía `window.__APP_CONFIG.apiBaseUrl`.  
   - `backend/`: API Node nativa que guarda las tareas en un `todos.json`.  
   - `scripts/`: bash scripts para desplegar frontend, backend y chequear el `/health`.

2. **Elegimos los proveedores**  
   - Backends en Render (`tp5-backend-qa` y `tp5-backend-prod`).  
   - Frontends en Netlify (`grand-taffy-6789e2-qa` y `grand-taffy-6789e2`).  
   Render se ocupa de correr Node y permitir health checks; Netlify sirve el estático sin vueltas.

3. **Workflow de CI** (`.github/workflows/ci.yml`)  
   - Para cada push/PR a `main`, valida el frontend con `node --check` y el backend con `npm test` (que por ahora es lint).  
   - Publica dos artefactos: `frontend-dist` y `backend-dist`. Así los deploys no recompilan nada.

4. **Workflow de Deploy** (`.github/workflows/deploy.yml`)  
   - Se dispara solo si el CI terminó bien.  
   - Job `deploy_qa`: descarga artefactos, reescribe `frontend/config.js` con la URL de QA, corre los scripts y después lanza `health_check.sh`.  
   - Job `deploy_prod`: igual que QA pero espera la aprobación manual del environment `prod` (definida desde Settings → Environments). Una vez aprobado, usa las variables/secrets de Prod y hace otro health check.

5. **Variables y secretos**  
   - Separados por environment (`qa`, `prod`).  
   - Secrets: tokens de deploy de Render y Netlify.  
   - Vars: URLs, IDs de servicios, endpoints de API, etc.  
   Los scripts son genéricos y reciben todo por env vars, sin hardcodear nada.

6. **Problemas que fuimos resolviendo**  
   - Tuvimos que mover el `package.json` del backend adentro de `backend/` para que CI y Render coincidan.  
   - Ajustamos los scripts de deploy para zipear el contenido correcto y subirlo a Render/Netlify con las APIs nuevas.  
   - Arreglamos CORS y aseguramos que cada entorno apunte a su backend correspondiente (hubo un slip cuando Prod le pegaba a QA).  
   - Añadimos health checks con reintentos y logs para ver qué se desplegó.

7. **Rollback y evidencias**  
   - Si algo sale mal, se puede re-lanzar un run anterior de Actions o usar el historial de Netlify/Render.  
   - Para la entrega vamos a sacar capturas de configs, runs exitosos y URLs funcionando, y las vamos a dejar documentadas.

## Conclusión rápida
Quedó un flujo donde GitHub Actions construye una sola vez, despliega a QA automáticamente, pide OK para Prod y valida ambos con health checks. Todo lo sensible está en secretos, y los scripts son reutilizables si cambiamos de proveedor. Trabajo cumplido.
#!/usr/bin/env bash
set -euo pipefail

API_TOKEN="${RENDER_API_KEY:-}"
SERVICE_ID="${RENDER_SERVICE_ID:-}"
IMAGE_PATH="${CONTAINER_IMAGE:-}"
REGION="${RENDER_REGION:-}"  # opcional, solo informativo

if [[ -z "$API_TOKEN" ]]; then
  echo "RENDER_API_KEY no definido" >&2
  exit 1
fi

if [[ -z "$SERVICE_ID" ]]; then
  echo "RENDER_SERVICE_ID no definido" >&2
  exit 1
fi

if [[ -z "$IMAGE_PATH" ]]; then
  echo "CONTAINER_IMAGE no definido" >&2
  exit 1
fi

API_URL="https://api.render.com/v1/services/${SERVICE_ID}/deploys"

payload=$(cat <<JSON
{
  "image": {
    "imagePath": "${IMAGE_PATH}"
  }
}
JSON
)

echo "Disparando deploy en Render service ${SERVICE_ID} con la imagen ${IMAGE_PATH} ${REGION:+(region $REGION)}"

response=$(curl -sS -o /tmp/render_deploy_response.json -w "%{http_code}" \
  -X POST "$API_URL" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [[ "$response" != "200" && "$response" != "201" ]]; then
  echo "Render API devolvió status ${response}. Respuesta completa:" >&2
  cat /tmp/render_deploy_response.json >&2
  exit 1
fi

echo "Deploy solicitado correctamente:"
cat /tmp/render_deploy_response.json

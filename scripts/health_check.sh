#!/usr/bin/env bash
set -euo pipefail

URL="${1:-}"

if [[ -z "$URL" ]]; then
  echo "Usage: health_check.sh <url>"
  exit 1
fi

echo "Verificando health check en ${URL}"

for attempt in {1..5}; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" "$URL" || echo "000")
  echo "Intento ${attempt}: status ${status}"
  if [[ "$status" == "200" ]]; then
    echo "Health check ok"
    exit 0
  fi
  sleep 5
done

echo "Health check falló"
exit 1


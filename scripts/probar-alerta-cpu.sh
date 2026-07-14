#!/usr/bin/env bash
set -Eeuo pipefail

REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"

echo "Generando carga de CPU durante 70 segundos..."

docker --context desktop-linux compose \
  --env-file .env.monitoring \
  -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  exec -T backend \
  node -e '
    const fin = Date.now() + 70000;

    while (Date.now() < fin) {
      Math.sqrt(Math.random());
    }
  '

echo
echo "Carga finalizada."
echo "Revisa la alerta CPU backend > 50 % en Grafana."

#!/usr/bin/env bash
set -Eeuo pipefail

REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"

COMPOSE=(
  docker --context desktop-linux compose
  --env-file .env.monitoring
  -f docker-compose.yml
  -f docker-compose.monitoring.yml
)

echo "Generando carga de CPU durante 75 segundos..."
"${COMPOSE[@]}" exec -T backend node -e '
  const fin = Date.now() + 75000;
  while (Date.now() < fin) Math.sqrt(Math.random());
'

echo "Carga finalizada. Revisa en Grafana:"
echo "Alerting > Alert rules > CPU backend superior al 50 por ciento"
echo "Logs > evento grafana_alert"

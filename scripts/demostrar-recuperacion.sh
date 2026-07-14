#!/usr/bin/env bash
set -Eeuo pipefail

REPO="$(git rev-parse --show-toplevel)"
ANSIBLE_VENV="$HOME/.local/share/barbercloud-ansible-venv"
cd "$REPO"

export ANSIBLE_CONFIG="$REPO/ansible/ansible.cfg"
export ANSIBLE_COLLECTIONS_PATH="$ANSIBLE_VENV/collections:$HOME/.ansible/collections:/usr/share/ansible/collections"

COMPOSE=(
  docker --context desktop-linux compose
  --env-file .env.monitoring
  -f docker-compose.yml
  -f docker-compose.monitoring.yml
)

recuperar() {
  "$ANSIBLE_VENV/bin/ansible-playbook" ansible/playbooks/desplegar-observabilidad.yml >/dev/null 2>&1 || true
}
trap recuperar EXIT

echo "1. Estado inicial del backend"
curl -fsS http://127.0.0.1:3001/health >/dev/null
echo "✓ Backend disponible"

echo "2. Simulando caída controlada"
"${COMPOSE[@]}" stop backend >/dev/null

CAIDA=0
for _ in $(seq 1 30); do
  valor="$(curl -fsSG --data-urlencode 'query=up{job="barbercloud-backend"}' http://127.0.0.1:9090/api/v1/query | python3 -c 'import json,sys; r=json.load(sys.stdin)["data"]["result"]; print(r[0]["value"][1] if r else "")' 2>/dev/null || true)"
  if [ "$valor" = "0" ]; then
    CAIDA=1
    break
  fi
  sleep 2
done

[ "$CAIDA" -eq 1 ] || {
  echo "ERROR: Prometheus no detectó la caída."
  exit 1
}
echo "✓ Prometheus detectó up=0"

echo "3. Recuperando mediante Ansible"
"$ANSIBLE_VENV/bin/ansible-playbook" ansible/playbooks/desplegar-observabilidad.yml

for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    echo "✓ Backend recuperado"
    trap - EXIT
    exit 0
  fi
  sleep 2
done

echo "ERROR: El backend no se recuperó."
exit 1

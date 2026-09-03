#!/usr/bin/env bash
#
# dev-forward.sh — Maintient les port-forwards frontend + backend vers le cluster
# local avec reconnexion automatique. La détection se fait par health-check HTTP :
# kubectl port-forward ne quitte pas quand le pod cible est remplacé (tunnel cassé
# mais process vivant), tester le port réel est donc le seul signal fiable.
#
# Usage :
#   bash scripts/dev-forward.sh
#
# Variables optionnelles : NAMESPACE (ticketin), FRONT_PORT (8080), BACK_PORT (8081).
#
set -uo pipefail

NAMESPACE="${NAMESPACE:-ticketin}"
FRONT_PORT="${FRONT_PORT:-8080}"
BACK_PORT="${BACK_PORT:-8081}"

ts() { date +%H:%M:%S; }

declare -A PF

port_of()  { [ "$1" = "frontend" ] && echo "$FRONT_PORT" || echo "$BACK_PORT"; }
check_url() { [ "$1" = "backend" ] && echo "http://127.0.0.1:$BACK_PORT/health" || echo "http://127.0.0.1:$FRONT_PORT/"; }

start_one() {
  local svc=$1 port
  port=$(port_of "$svc")
  kubectl -n "$NAMESPACE" port-forward "svc/$svc" "$port:80" --address=127.0.0.1 >/dev/null 2>&1 &
  PF[$svc]=$!
  echo "[$(ts)] svc/$svc : http://localhost:$port (pid ${PF[$svc]})"
}

restart_one() {
  local svc=$1
  kill "${PF[$svc]}" 2>/dev/null || true
  sleep 1
  start_one "$svc"
}

healthy() {
  local code
  code=$(curl -s -o /dev/null -m 3 -w "%{http_code}" "$(check_url "$1")" 2>/dev/null)
  [ "$code" = "200" ]
}

cleanup() {
  echo ""
  echo "[$(ts)] Arrêt des port-forwards…"
  for pid in "${PF[@]}"; do kill "$pid" 2>/dev/null || true; done
  exit 0
}
trap cleanup INT TERM

if ! kubectl -n "$NAMESPACE" get svc frontend backend >/dev/null 2>&1; then
  echo "Services frontend/backend introuvables dans '$NAMESPACE'." >&2
  echo "Le cluster est-il démarré (minikube start) et les workloads appliqués ?" >&2
  exit 1
fi

start_one frontend
start_one backend
echo "[$(ts)] Actifs. Front: http://localhost:$FRONT_PORT | Back: http://localhost:$BACK_PORT"
echo "[$(ts)] Surveillance et reconnexion auto activées (Ctrl+C pour arrêter)."

sleep 4

# Tolère 2 échecs consécutifs pour ne pas reconnecter sur un simple à-coup.
declare -A MISS=([frontend]=0 [backend]=0)
while true; do
  for svc in frontend backend; do
    if ! kill -0 "${PF[$svc]}" 2>/dev/null; then
      echo "[$(ts)] svc/$svc : process arrêté, reconnexion…"
      start_one "$svc"; MISS[$svc]=0
    elif ! healthy "$svc"; then
      MISS[$svc]=$(( MISS[$svc] + 1 ))
      if [ "${MISS[$svc]}" -ge 2 ]; then
        echo "[$(ts)] svc/$svc : ne répond plus (tunnel cassé), reconnexion…"
        restart_one "$svc"; MISS[$svc]=0
      fi
    else
      MISS[$svc]=0
    fi
  done
  sleep 3
done

#!/usr/bin/env bash
#
# seed-local.sh — Peuple la base Postgres du cluster minikube local : ouvre un
# port-forward vers Postgres, lance le seed (prisma/seed.ts), referme le tunnel.
#
# Usage :
#   ./scripts/seed-local.sh
#
# Variables optionnelles : NAMESPACE (ticketin), LOCAL_PORT (55432).
# Les identifiants du seed sont lus par prisma/seed.ts depuis backend/.env.
#
set -euo pipefail

NAMESPACE="${NAMESPACE:-ticketin}"
LOCAL_PORT="${LOCAL_PORT:-55432}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"

# 127.0.0.1 forcé (IPv4) : sous Windows, "localhost" résout d'abord en IPv6
# et raterait le port-forward, qui n'écoute qu'en IPv4.
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${LOCAL_PORT}/ticketin"

PF_PID=""
cleanup() {
  if [[ -n "$PF_PID" ]] && kill -0 "$PF_PID" 2>/dev/null; then
    kill "$PF_PID" 2>/dev/null || true
    echo "Port-forward arrêté."
  fi
}
trap cleanup EXIT

echo "Vérification du cluster (namespace: $NAMESPACE)..."
if ! kubectl -n "$NAMESPACE" get pod -l app=postgres -o name | grep -q .; then
  echo "Aucun pod Postgres trouvé dans le namespace '$NAMESPACE'." >&2
  echo "Le cluster est-il démarré (minikube start) et les workloads appliqués ?" >&2
  exit 1
fi

echo "Ouverture du port-forward Postgres (127.0.0.1:${LOCAL_PORT} vers svc/postgres:5432)..."
kubectl -n "$NAMESPACE" port-forward svc/postgres "${LOCAL_PORT}:5432" --address=127.0.0.1 >/dev/null 2>&1 &
PF_PID=$!

echo -n "Attente du tunnel"
for _ in $(seq 1 30); do
  if (exec 3<>"/dev/tcp/127.0.0.1/${LOCAL_PORT}") 2>/dev/null; then
    exec 3>&- 3<&- 2>/dev/null || true
    echo " : prêt."
    break
  fi
  if ! kill -0 "$PF_PID" 2>/dev/null; then
    echo ""
    echo "Le port-forward s'est arrêté (port ${LOCAL_PORT} déjà utilisé ?)." >&2
    exit 1
  fi
  echo -n "."
  sleep 0.5
done

cd "$BACKEND_DIR"
echo "Lancement du seed..."
# Réessais : sur un cluster fraîchement créé, Postgres peut mettre quelques
# secondes de plus à accepter les connexions que le tunnel à s'établir.
ok=0
for attempt in 1 2 3 4; do
  if npm run db:seed; then ok=1; break; fi
  echo "Tentative $attempt échouée (Postgres pas encore prêt ?), nouvel essai dans 4s…"
  sleep 4
done
[ "$ok" = "1" ] || { echo "Seed échoué après 4 tentatives." >&2; exit 1; }

echo "Seed terminé sur la base du cluster."

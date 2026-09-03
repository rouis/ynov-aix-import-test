#!/usr/bin/env bash
#
# dev-up.sh — Démarre l'environnement local existant : Docker Desktop, minikube,
# attente des pods, puis port-forwards avec reconnexion auto (dev-forward.sh).
#
# Usage :
#   bash scripts/dev-up.sh
#
# Prérequis : l'infra doit avoir été déployée au moins une fois (docs/LOCAL_K8S.md).
# Frontend : http://localhost:8080 | Backend : http://localhost:8081
#
set -uo pipefail

NAMESPACE="${NAMESPACE:-ticketin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ts()  { date +%H:%M:%S; }
log() { echo "[$(ts)] $*"; }
die() { echo "[$(ts)] $*" >&2; exit 1; }

# 1. Docker
if docker info >/dev/null 2>&1; then
  log "Docker déjà démarré."
else
  log "Docker éteint, lancement de Docker Desktop…"
  for p in \
    "/c/Program Files/Docker/Docker/Docker Desktop.exe" \
    "/c/Program Files (x86)/Docker/Docker/Docker Desktop.exe"; do
    if [ -f "$p" ]; then
      MSYS_NO_PATHCONV=1 powershell.exe -NoProfile -Command "Start-Process '$(cygpath -w "$p")'" >/dev/null 2>&1 || true
      break
    fi
  done
  log "Attente du moteur Docker (jusqu'à 180s)…"
  for i in $(seq 1 36); do
    docker info >/dev/null 2>&1 && { log "Docker prêt."; break; }
    [ "$i" -eq 36 ] && die "Docker ne répond pas. Démarre Docker Desktop manuellement puis relance."
    sleep 5
  done
fi

# 2. minikube
if kubectl get nodes >/dev/null 2>&1; then
  log "Cluster minikube déjà joignable."
else
  log "Démarrage de minikube…"
  minikube start || die "Échec de 'minikube start'."
fi

# 3. Workloads présents ?
if ! kubectl -n "$NAMESPACE" get deploy backend frontend >/dev/null 2>&1; then
  die "Les déploiements backend/frontend sont absents du namespace '$NAMESPACE'.
   L'infra n'a jamais été appliquée : suis docs/LOCAL_K8S.md (kubectl apply ...)."
fi

log "Attente que les pods soient prêts (jusqu'à 180s)…"
kubectl -n "$NAMESPACE" wait --for=condition=Available deploy --all --timeout=180s \
  || die "Des pods ne sont pas prêts. Inspecte : kubectl -n $NAMESPACE get pods"
log "Tous les déploiements sont disponibles."

# 4. Port-forwards (processus long, prend la main)
log "Ouverture des port-forwards…"
exec bash "$SCRIPT_DIR/dev-forward.sh"

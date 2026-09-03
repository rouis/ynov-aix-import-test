#!/usr/bin/env bash
#
# dev-bootstrap.sh — Monte tout l'environnement local à partir de rien : Docker,
# minikube, images, secret, workloads, bucket MinIO, seed, port-forwards.
# Idempotent : ce qui existe déjà est sauté.
#
# Usage :
#   bash scripts/dev-bootstrap.sh
#   WITH_MAIL=1 bash scripts/dev-bootstrap.sh   # active aussi l'ingestion email
#
# WITH_MAIL=1 connecte le cluster à la vraie boîte mail configurée dans
# backend/.env (lecture, marquage lu, envoi de confirmations). Voir enable-mail.sh.
#
set -uo pipefail

NS="${NAMESPACE:-ticketin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACK_IMG="ghcr.io/rookuro/ticketin-backend:latest"
FRONT_IMG="ghcr.io/rookuro/ticketin-frontend:latest"
FRONT_PORT="${FRONT_PORT:-8080}"
BACK_PORT="${BACK_PORT:-8081}"

ts()  { date +%H:%M:%S; }
log() { echo "[$(ts)] $*"; }
die() { echo "[$(ts)] $*" >&2; exit 1; }

# 1. Docker
if docker info >/dev/null 2>&1; then
  log "Docker déjà démarré."
else
  log "Docker éteint, lancement de Docker Desktop…"
  for p in "/c/Program Files/Docker/Docker/Docker Desktop.exe" \
           "/c/Program Files (x86)/Docker/Docker/Docker Desktop.exe"; do
    [ -f "$p" ] && { MSYS_NO_PATHCONV=1 powershell.exe -NoProfile -Command "Start-Process '$(cygpath -w "$p")'" >/dev/null 2>&1 || true; break; }
  done
  for i in $(seq 1 36); do
    docker info >/dev/null 2>&1 && { log "Docker prêt."; break; }
    [ "$i" -eq 36 ] && die "Docker ne répond pas. Démarre Docker Desktop puis relance."
    sleep 5
  done
fi

# 2. minikube + metrics-server
if kubectl get nodes >/dev/null 2>&1; then
  log "Cluster minikube déjà joignable."
else
  log "Démarrage de minikube…"
  minikube start --driver=docker || die "Échec de 'minikube start'."
fi
minikube addons enable metrics-server >/dev/null 2>&1 && log "metrics-server actif." || true

# 3. Build des images (si absentes du daemon minikube)
eval "$(minikube -p minikube docker-env --shell bash)"
if [ -z "$(docker images -q "$BACK_IMG" 2>/dev/null)" ]; then
  log "Build de l'image backend…"
  docker build -t "$BACK_IMG" "$ROOT/backend" >/dev/null || die "Build backend échoué."
  log "Image backend construite."
else
  log "Image backend déjà présente."
fi
if [ -z "$(docker images -q "$FRONT_IMG" 2>/dev/null)" ]; then
  log "Build de l'image frontend (API : http://localhost:$BACK_PORT)…"
  docker build --build-arg "NEXT_PUBLIC_API_URL=http://localhost:$BACK_PORT" -t "$FRONT_IMG" "$ROOT/frontend" >/dev/null || die "Build frontend échoué."
  log "Image frontend construite."
else
  log "Image frontend déjà présente."
fi

# 4. Namespace + secret
kubectl apply -f "$ROOT/k8s/namespace.yaml" >/dev/null
if kubectl -n "$NS" get secret backend-secret >/dev/null 2>&1; then
  log "Secret backend déjà présent."
else
  log "Création du secret backend (clé générée)…"
  kubectl -n "$NS" create secret generic backend-secret \
    --from-literal=DATABASE_URL='postgresql://postgres:postgres@postgres:5432/ticketin' \
    --from-literal=COMPLEX_SECRET_KEY="$(openssl rand -hex 32)" \
    --from-literal=S3_ENDPOINT='http://minio:9000' \
    --from-literal=S3_BUCKET='ticketin' \
    --from-literal=S3_ACCESS_KEY='minioadmin' \
    --from-literal=S3_SECRET_KEY='minioadmin' >/dev/null
  log "Secret créé."
fi

# 5. Workloads (sans Gateway ni certificats : accès par port-forward)
log "Application des workloads…"
kubectl apply \
  -f "$ROOT/k8s/postgres/pvc.yaml"   -f "$ROOT/k8s/postgres/deployment.yaml"  -f "$ROOT/k8s/postgres/service.yaml" \
  -f "$ROOT/k8s/minio/pvc.yaml"      -f "$ROOT/k8s/minio/deployment.yaml"     -f "$ROOT/k8s/minio/service.yaml" \
  -f "$ROOT/k8s/backend/deployment.yaml"  -f "$ROOT/k8s/backend/service.yaml" -f "$ROOT/k8s/backend/hpa.yaml" \
  -f "$ROOT/k8s/frontend/deployment.yaml" -f "$ROOT/k8s/frontend/service.yaml" >/dev/null || die "kubectl apply échoué."

# 6. CORS : FRONT_URL (absent des manifests, requis en local)
kubectl -n "$NS" set env deploy/backend FRONT_URL="http://localhost:$FRONT_PORT" >/dev/null

# 7. Attente des pods
log "Attente que les pods soient prêts (jusqu'à 240s)…"
kubectl -n "$NS" wait --for=condition=Available deploy --all --timeout=240s \
  || die "Des pods ne sont pas prêts : kubectl -n $NS get pods"
log "Tous les déploiements sont disponibles."

# 8. Bucket MinIO
log "Vérification du bucket MinIO « ticketin »…"
kubectl -n "$NS" delete pod mc-setup --ignore-not-found >/dev/null 2>&1
kubectl -n "$NS" run mc-setup --restart=Never --image=minio/mc \
  --env=MC_HOST_local=http://minioadmin:minioadmin@minio:9000 -- mb -p local/ticketin >/dev/null 2>&1
for _ in $(seq 1 20); do
  ph=$(kubectl -n "$NS" get pod mc-setup -o jsonpath='{.status.phase}' 2>/dev/null)
  { [ "$ph" = "Succeeded" ] || [ "$ph" = "Failed" ]; } && break
  sleep 3
done
kubectl -n "$NS" delete pod mc-setup --ignore-not-found >/dev/null 2>&1
log "Bucket prêt."

# 9. Seed (seulement si la base est vide)
PG=$(kubectl -n "$NS" get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
USERS=$(kubectl -n "$NS" exec "$PG" -- psql -U postgres -d ticketin -tAc 'SELECT count(*) FROM "User"' 2>/dev/null | tr -d '[:space:]')
if [ "${USERS:-0}" = "0" ]; then
  log "Base vide, lancement du seed…"
  bash "$SCRIPT_DIR/seed-local.sh" || log "Seed échoué (à relancer : bash scripts/seed-local.sh)"
else
  log "Base déjà peuplée ($USERS comptes)."
fi

# 9b. Ingestion email (opt-in via WITH_MAIL=1)
if [ "${WITH_MAIL:-0}" = "1" ]; then
  log "WITH_MAIL=1, activation de l'ingestion email…"
  bash "$SCRIPT_DIR/enable-mail.sh" || log "enable-mail échoué (à relancer : bash scripts/enable-mail.sh)"
fi

# 10. Port-forwards (processus long, prend la main)
log "Ouverture des accès…"
exec bash "$SCRIPT_DIR/dev-forward.sh"

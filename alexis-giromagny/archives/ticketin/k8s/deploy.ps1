# Script de déploiement complet — ticketin sur minikube
# Usage: .\k8s\deploy.ps1

$ErrorActionPreference = "Stop"

# Prompt for Username
$ghUser = Read-Host "Entrez votre nom d'utilisateur GitHub"
if ([string]::IsNullOrWhiteSpace($ghUser)) {
    Write-Host "Erreur : Le nom d'utilisateur ne peut pas être vide." -ForegroundColor Red
    exit 1
}

# Prompt for PAT (hides input)
Write-Host "Entrez votre Personal Access Token (PAT) pour GHCR (avec scope 'read:packages')."
$ghToken = Read-Host "Votre Token"

if ([string]::IsNullOrWhiteSpace($ghToken)) {
    Write-Host "Erreur : Le token ne peut pas être vide." -ForegroundColor Red
    exit 1
}

Write-Host "=== 1. Démarrage minikube ===" -ForegroundColor Cyan
minikube start --driver=docker
if (-not $?) { exit 1 }

Write-Host "`n=== 2. Création du namespace ===" -ForegroundColor Cyan
kubectl apply -f k8s/namespace.yaml

# Verify the namespace exists before proceeding
$nsExists = kubectl get namespace ticketin --ignore-not-found
if ([string]::IsNullOrWhiteSpace($nsExists)) {
    Write-Host "Erreur : Le namespace 'ticketin' n'a pas été créé." -ForegroundColor Red
    exit 1
}
Write-Host "  Namespace 'ticketin' créé ou déjà présent." -ForegroundColor Green

Write-Host "`n=== 3. Configuration de l'image Pull Secret (GHCR) ===" -ForegroundColor Cyan

# Create or Update the secret
Write-Host "  Création/Mise à jour du secret 'ghcr-pull'..." -ForegroundColor Gray

# Delete first to ensure a clean slate
kubectl delete secret ghcr-pull --namespace ticketin --ignore-not-found

kubectl create secret docker-registry ghcr-pull `
  --namespace ticketin `
  --docker-server=ghcr.io `
  --docker-username=$ghUser `
  --docker-password=$ghToken

if (-not $?) {
    Write-Host "Erreur : Échec de la création du secret. Vérifiez vos credentials." -ForegroundColor Red
    exit 1
}

Write-Host "  Secret créé avec succès." -ForegroundColor Green

Write-Host "`n=== 4. Build des images Docker dans le contexte minikube ===" -ForegroundColor Cyan
# Pointer Docker vers le daemon minikube
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Build backend
Write-Host "  Building ticketin/backend:latest..."
docker build -t ticketin/backend:latest ./backend

# Build frontend avec la bonne URL API (baked à la compilation)
Write-Host "  Building ticketin/frontend:latest..."
docker build `
  --build-arg NEXT_PUBLIC_API_URL=http://api.127.0.0.1.nip.io:8000 `
  -t ticketin/frontend:latest `
  ./frontend

Write-Host "`n=== 5. Activation du addon Gateway API (Traefik) ===" -ForegroundColor Cyan
minikube addons enable ingress
# Si tu utilises le Gateway API natif, installe les CRDs :
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml

Write-Host "`n=== 6. Déploiement des manifests k8s ===" -ForegroundColor Cyan
# Namespace is already created, so we skip it here, but apply the rest
kubectl apply -f k8s/gateway.yaml
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/minio/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/

Write-Host "`n=== 7. Attendre que les pods soient Ready ===" -ForegroundColor Cyan
kubectl wait --namespace ticketin `
  --for=condition=ready pod `
  --selector=app=postgres `
  --timeout=120s

kubectl wait --namespace ticketin `
  --for=condition=ready pod `
  --selector=app=backend `
  --timeout=120s

kubectl wait --namespace ticketin `
  --for=condition=ready pod `
  --selector=app=frontend `
  --timeout=120s

Write-Host "`n=== 8. Tunnel minikube (laisser tourner dans un autre terminal) ===" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "minikube tunnel"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "kubectl port-forward -n ticketin svc/minio 9001:9001"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "kubectl port-forward -n ticketin svc/backend 8001:80"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "kubectl port-forward -n ticketin svc/frontend 8000:80"
Write-Host ""
Write-Host "=== URLs d'accès ===" -ForegroundColor Green
Write-Host "  Frontend : http://web.127.0.0.1.nip.io:8000"
Write-Host "  API      : http://api.127.0.0.1.nip.io:8001"
Write-Host "  Swagger  : http://api.127.0.0.1.nip.io:8001/api"
Write-Host "  MinIO    : http://localhost:9001"
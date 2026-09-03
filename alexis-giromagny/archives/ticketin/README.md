# Ticketin

Application de gestion de tickets multi-tenant.
Stack : **NestJS** (backend) · **Next.js** (frontend) · **PostgreSQL** · **MinIO** · **Kubernetes / Minikube**

---

## Prérequis

| Outil | Version testée | Rôle |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 28+ | Runtime des conteneurs |
| [Minikube](https://minikube.sigs.k8s.io/docs/start/) | 1.38+ | Cluster Kubernetes local |
| [kubectl](https://kubernetes.io/docs/tasks/tools/) | 1.35+ | CLI Kubernetes |

---

## Architecture

```
[Navigateur]
     │
     ▼ port 80
[Traefik Gateway – 127.0.0.1]
     ├── web.127.0.0.1.nip.io  ──► frontend (Next.js :3000)
     └── api.127.0.0.1.nip.io  ──► backend  (NestJS  :3000)
                                        │
                                   postgres:5432
                                   minio:9000
```

Le domaine `*.127.0.0.1.nip.io` résout automatiquement vers `127.0.0.1` — aucune modification du fichier `hosts` nécessaire.

---

## Lancer le projet

### 1. Démarrer Docker Desktop

Lance Docker Desktop et attends que l'icône dans la barre des tâches indique qu'il est prêt.

### 2. Démarrer Minikube

```powershell
minikube start --driver=docker
```

Durée : environ 1-2 minutes. Le démarrage est terminé quand tu vois :

```
Done! kubectl is now configured to use "minikube" cluster
```

### 3. S'authentifier via GitHub

Ajoute le namespace:
```powershell
kubectl apply -f k8s/namespace.yaml
```

Authentifie-toi avec ton compte GitHub avec accès au repo/packages Ticket'in.
Remplace avec ton nom d'utilisateur GitHub et ton Private Access Token. Le PAT a besoin du scope `read:packages`.
```powershell
kubectl delete secret ghcr-pull --namespace ticketin --ignore-not-found

kubectl create secret docker-registry ghcr-pull `
  --namespace ticketin `
  --docker-server=ghcr.io `
  --docker-username=NOM_D_UTILISATEUR `
  --docker-password=ACCESS_TOKEN
```

### 4. Builder les images Docker

Les images doivent être construites **dans le contexte Docker de Minikube** (sinon le cluster ne les trouvera pas, car `imagePullPolicy: Never`).

```powershell
# Pointer Docker vers le daemon Minikube
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Builder le backend
docker build -t ticketin/backend:latest ./backend

# Builder le frontend
# NEXT_PUBLIC_API_URL est baked à la compilation — ne pas changer la valeur
docker build `
  --build-arg NEXT_PUBLIC_API_URL=http://api.127.0.0.1.nip.io `
  -t ticketin/frontend:latest `
  ./frontend
```

> **Important — Next.js** : les variables `NEXT_PUBLIC_*` sont intégrées dans le bundle JS au moment du build, pas au runtime. La valeur dans `k8s/frontend/deployment.yaml` n'a pas d'effet sur le client. Toujours passer l'URL via `--build-arg`.

### 5. Déployer sur Kubernetes

```powershell
minikube addons enable ingress

kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml
```

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/gateway.yaml
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/minio/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
```

### 6. Ouvrir le tunnel (laisser ce terminal ouvert)

```powershell
minikube tunnel
```

Ce processus expose le LoadBalancer Traefik sur `127.0.0.1:80`. Il doit rester actif tant que tu veux accéder à l'application.

---

Pour accéder au frontend :

```powershell
kubectl port-forward -n ticketin svc/frontend 8000:80
# puis ouvrir http://web.127.0.0.1.nip.io:8000/ (login: admin@ticketin.local / ChangeMe1234! OU agent@ticketin.local / Agent1234!)
```

Pour accéder au backend :

```powershell
kubectl port-forward -n ticketin svc/backend 8001:80
# puis ouvrir http://api.127.0.0.1.nip.io:8001/
# et/ou http://api.127.0.0.1.nip.io:8001/api
```

**MinIO** n'est pas exposé via le gateway. Pour accéder à la console :

```powershell
kubectl port-forward -n ticketin svc/minio 9001:9001
# puis ouvrir http://localhost:9001  (login: minioadmin / minioadmin)
```

---

## Vérifier que tout fonctionne

```powershell
# État des pods
kubectl get pods -n ticketin

# Health check backend
curl http://api.127.0.0.1.nip.io/health

# Readiness check (vérifie aussi la connexion PostgreSQL)
curl http://api.127.0.0.1.nip.io/ready
```

Sortie attendue pour `/health` :

```json
{"status":"ok","info":{},"error":{},"details":{}}
```

Tous les pods doivent être `1/1 Running` :

```
NAME                        READY   STATUS    RESTARTS
backend-xxx                 1/1     Running   0
frontend-xxx                1/1     Running   0
minio-xxx                   1/1     Running   0
postgres-xxx                1/1     Running   0
```

### Script de diagnostic rapide

```powershell
.\k8s\check.ps1
```

---

## Arrêter le projet

```powershell
# Arrêter Minikube (les pods sont supprimés, les données postgres sont perdues)
minikube stop

# Supprimer tous les manifests du namespace (sans arrêter Minikube)
kubectl delete namespace ticketin
```

---

## Structure du dossier k8s

```
k8s/
├── namespace.yaml          Namespace "ticketin"
├── gateway.yaml            Gateway Traefik (port 80 externe)
├── postgres/
│   ├── deployment.yaml     Base de données PostgreSQL
│   └── service.yaml
├── minio/
│   ├── deployment.yaml     Stockage objet S3-compatible
│   └── service.yaml
├── backend/
│   ├── deployment.yaml     API NestJS (1 replica + init migration Prisma)
│   ├── service.yaml
│   ├── secret.yaml         Credentials DB, JWT, S3
│   └── httproute.yaml      Route → api.127.0.0.1.nip.io
├── frontend/
│   ├── deployment.yaml     App Next.js
│   ├── service.yaml
│   └── httproute.yaml      Route → web.127.0.0.1.nip.io
├── deploy.ps1              Script de déploiement complet
└── check.ps1               Script de diagnostic
```

---

## Notes importantes

- **Données éphémères** : PostgreSQL et MinIO utilisent `emptyDir` — les données sont perdues si les pods redémarrent. Pour persister les données, remplacer par un `PersistentVolumeClaim`.
- **Secrets en clair** : `k8s/backend/secret.yaml` contient des credentials en clair. Ne jamais committer ce fichier avec de vrais secrets en production.
- **Migrations** : exécutées automatiquement au démarrage du pod backend via un init container (`prisma migrate deploy`).

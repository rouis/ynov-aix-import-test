# Script de vérification — état du cluster ticketin
# Usage: .\k8s\check.ps1

Write-Host "=== Pods ===" -ForegroundColor Cyan
kubectl get pods -n ticketin -o wide

Write-Host "`n=== Services ===" -ForegroundColor Cyan
kubectl get svc -n ticketin

Write-Host "`n=== Gateway & HTTPRoutes ===" -ForegroundColor Cyan
kubectl get gateway,httproute -n ticketin

Write-Host "`n=== Logs backend (20 dernières lignes) ===" -ForegroundColor Cyan
kubectl logs -n ticketin -l app=backend --tail=20

Write-Host "`n=== Health checks ===" -ForegroundColor Cyan
$backend = kubectl get pod -n ticketin -l app=backend -o jsonpath='{.items[0].metadata.name}' 2>$null
if ($backend) {
    Write-Host "  /health :"
    kubectl exec -n ticketin $backend -- wget -qO- http://localhost:3000/health 2>&1
    Write-Host "`n  /ready :"
    kubectl exec -n ticketin $backend -- wget -qO- http://localhost:3000/ready 2>&1
}

Write-Host "`n=== Events récents (erreurs) ===" -ForegroundColor Cyan
kubectl get events -n ticketin --sort-by='.lastTimestamp' | Select-Object -Last 15

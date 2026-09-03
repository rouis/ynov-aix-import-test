#!/usr/bin/env bash
#
# start.sh — Lance tout l'environnement local (raccourci de dev-bootstrap.sh).
#
# Usage :
#   bash scripts/start.sh               # tout, ingestion email comprise
#   WITH_MAIL=0 bash scripts/start.sh   # tout sauf l'ingestion email
#
# Frontend : http://localhost:8080 | Backend : http://localhost:8081
#
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec env WITH_MAIL="${WITH_MAIL:-1}" bash "$SCRIPT_DIR/dev-bootstrap.sh"

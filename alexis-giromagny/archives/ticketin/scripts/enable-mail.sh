#!/usr/bin/env bash
#
# enable-mail.sh — Active l'ingestion d'emails entrants sur le backend du cluster
# local, en lisant la config IMAP/SMTP depuis backend/.env.
#
# Attention : se connecte à la vraie boîte configurée. Le poller lit les emails
# non lus, les marque comme lus, crée des tickets et envoie une confirmation aux
# expéditeurs réels.
#
# Usage :
#   bash scripts/enable-mail.sh
#
# Pour désactiver ensuite :
#   kubectl -n ticketin set env deploy/backend INBOUND_MAIL_ENABLED=false
#
set -uo pipefail

NS="${NAMESPACE:-ticketin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../backend/.env"

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE introuvable, impossible de lire la config IMAP." >&2; exit 1; }
get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }

IMAP_HOST=$(get IMAP_HOST);   IMAP_PORT=$(get IMAP_PORT);   IMAP_USER=$(get IMAP_USER)
IMAP_PASS=$(get IMAP_PASS);   IMAP_TLS=$(get IMAP_TLS);     IMAP_FOLDER=$(get IMAP_FOLDER)
SMTP_HOST=$(get SMTP_HOST);   SMTP_PORT=$(get SMTP_PORT)
SMTP_USER=$(get SMTP_USER);   SMTP_PASS=$(get SMTP_PASS);   MAIL_FROM=$(get MAIL_FROM)
ALLOWED=$(get INBOUND_ALLOWED_DOMAINS)
CATEGORY=$(get INBOUND_DEFAULT_CATEGORY)

if [ -z "$IMAP_HOST" ] || [ -z "$IMAP_USER" ] || [ -z "$IMAP_PASS" ]; then
  echo "Config IMAP incomplète dans backend/.env (IMAP_HOST/IMAP_USER/IMAP_PASS requis)." >&2
  exit 1
fi
if [ -z "$ALLOWED" ]; then
  echo "INBOUND_ALLOWED_DOMAINS est vide : tous les expéditeurs seront rejetés." >&2
fi

echo "Activation de l'ingestion email"
echo "    boîte    : $IMAP_USER ($IMAP_HOST:${IMAP_PORT:-993})"
echo "    domaines : ${ALLOWED:-<aucun>}"

# INBOUND_ORGANIZATION_ID est retiré (suffixe '-') : sur une base locale, l'UUID
# d'organisation diffère de celui du .env ; le code rattache alors les tickets à
# la première organisation en base.
kubectl -n "$NS" set env deploy/backend \
  INBOUND_MAIL_ENABLED=true \
  INBOUND_POLL_MODE=inprocess \
  IMAP_HOST="$IMAP_HOST" IMAP_PORT="${IMAP_PORT:-993}" IMAP_TLS="${IMAP_TLS:-true}" \
  IMAP_USER="$IMAP_USER" IMAP_PASS="$IMAP_PASS" IMAP_FOLDER="${IMAP_FOLDER:-INBOX}" \
  SMTP_HOST="$SMTP_HOST" SMTP_PORT="${SMTP_PORT:-587}" \
  SMTP_USER="$SMTP_USER" SMTP_PASS="$SMTP_PASS" \
  MAIL_FROM="$MAIL_FROM" \
  INBOUND_ALLOWED_DOMAINS="$ALLOWED" \
  INBOUND_DEFAULT_CATEGORY="${CATEGORY:-Email}" \
  INBOUND_ORGANIZATION_ID- >/dev/null

echo "Redéploiement du backend…"
kubectl -n "$NS" rollout status deploy/backend --timeout=150s
echo "Ingestion email activée (polling toutes les minutes du dossier ${IMAP_FOLDER:-INBOX})."
echo "Suivi : kubectl -n $NS logs -f deploy/backend | grep -iE 'ingestion|imap|refus'"

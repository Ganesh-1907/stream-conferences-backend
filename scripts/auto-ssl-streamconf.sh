#!/bin/bash
# Auto-SSL for Stream Conferences
# Manages TWO certs:
#   1. streamconferences.com          -> root, www, admin, api (base domains)
#   2. streamconferences-subdomains   -> all event subdomains (*.streamconferences.com)
# Runs every 5 min (cron). Reissues ONLY when the domain list actually changes.
# Safety: if the API returns no subdomains (backend down), SKIP entirely so the
# existing cert is never replaced with a base-only cert.

API="http://localhost:7867/api"
BASE_CERT="streamconferences.com"
SUBS_CERT="streamconferences-subdomains"
LOG="/var/log/auto-ssl-streamconf.log"
WEBROOT="-w /var/www/certbot"
EMAIL="--email ganesh@buildyourvision.in"
COMMON="--non-interactive --agree-tos --webroot -w /var/www/certbot"

exec 200>/var/lock/auto-ssl-streamconf.lock
flock -n 200 || { echo "$(date): Another instance running, skipping" >> "$LOG"; exit 0; }

log() { echo "$(date): $1" >> "$LOG"; }

# --- Collect event subdomains from the conferences API -------------------
SUBS=$(curl -s --max-time 10 "$API/conferences" 2>/dev/null | python3 -c "
import sys,json
try:
    for c in json.load(sys.stdin):
        s=c.get('subdomain')
        if s: print(s)
except Exception:
    pass
" 2>/dev/null | sort -u)

# CRITICAL GUARD: empty result => backend likely down. Never reissue from that.
if [ -z "$SUBS" ]; then
    log "SKIP: no subdomains returned by API (backend down?) - certs left untouched"
    exit 0
fi

DESIRED_SUBS=$(for s in $SUBS; do echo "${s}.streamconferences.com"; done | sort -u)

# --- Helper: list domains of an existing cert (from cert PEM, not certbot) --
cert_domains() {
    if [ -f "/etc/letsencrypt/live/$1/fullchain.pem" ]; then
        openssl x509 -noout -ext subjectAltName -in "/etc/letsencrypt/live/$1/fullchain.pem" 2>/dev/null \
          | grep -oE '[A-Za-z0-9.*-]+\.[A-Za-z]{2,}' | sort -u
    fi
}

# --- 1. Base cert: root/www/admin/api (issue only if missing) --------------
BASE_DESIRED=$(printf '%s\n' streamconferences.com www.streamconferences.com admin.streamconferences.com api.streamconferences.com | sort -u)
BASE_CURRENT=$(cert_domains "$BASE_CERT")
if [ -z "$BASE_CURRENT" ]; then
    log "Issuing base cert $BASE_CERT"
    if certbot certonly --cert-name "$BASE_CERT" $COMMON $EMAIL \
        -d streamconferences.com -d www.streamconferences.com \
        -d admin.streamconferences.com -d api.streamconferences.com >> "$LOG" 2>&1; then
        systemctl reload nginx; log "Base cert issued"
    else
        log "ERROR: base cert issuance failed"
    fi
elif [ "$BASE_CURRENT" != "$BASE_DESIRED" ]; then
    # A base domain set exists but differs (e.g. old 15-domain set) -> fix it once
    log "Normalizing base cert $BASE_CERT (was: $(echo $BASE_CURRENT | tr '\n' ' '))"
    if certbot certonly --cert-name "$BASE_CERT" --force-renewal $COMMON $EMAIL \
        -d streamconferences.com -d www.streamconferences.com \
        -d admin.streamconferences.com -d api.streamconferences.com >> "$LOG" 2>&1; then
        systemctl reload nginx; log "Base cert normalized"
    else
        log "WARN: base cert normalize failed (rate limit?) - will retry next run"
    fi
fi

# --- 2. Subdomains cert: event microsites ----------------------------------
SUBS_CURRENT=$(cert_domains "$SUBS_CERT")

if [ -z "$SUBS_CURRENT" ]; then
    log "Issuing subdomains cert $SUBS_CERT ($(echo "$DESIRED_SUBS" | wc -l) domains)"
    FLAGS=""
    for d in $DESIRED_SUBS; do FLAGS="$FLAGS -d $d"; done
    if certbot certonly --cert-name "$SUBS_CERT" $COMMON $EMAIL $FLAGS >> "$LOG" 2>&1; then
        systemctl reload nginx; log "Subdomains cert issued"
    else
        log "ERROR: subdomains cert issuance failed"
    fi
elif [ "$SUBS_CURRENT" != "$DESIRED_SUBS" ]; then
    # Only reached when a subdomain was added/removed -> new identifier set -> OK for LE limits
    log "Domain list changed, reissuing $SUBS_CERT (new: $(echo "$DESIRED_SUBS" | tr '\n' ' '))"
    FLAGS=""
    for d in $DESIRED_SUBS; do FLAGS="$FLAGS -d $d"; done
    if certbot certonly --cert-name "$SUBS_CERT" --force-renewal $COMMON $EMAIL $FLAGS >> "$LOG" 2>&1; then
        systemctl reload nginx; log "Subdomains cert reissued"
    else
        log "ERROR: subdomains reissue failed (rate limit? retry in 7 days) - old cert still active"
    fi
else
    # no change
    :
fi

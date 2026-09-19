#!/bin/bash
# Auto-SSL for Stream Conferences subdomains
# Triggered on conference/webinar creation AND runs every 5 minutes via cron.
# Detects new domains and force-reissues the consolidated cert only when needed.

API="http://localhost:7867/api"
CERT_NAME="streamconferences.com"
LOG="/var/log/auto-ssl-streamconf.log"

exec 200>/var/lock/auto-ssl-streamconf.lock
flock -n 200 || { echo "$(date): Another instance running, skipping" >> "$LOG"; exit 0; }

# Get all subdomains from conferences
SUBS=$(curl -s "$API/conferences" 2>/dev/null | python3 -c "
import sys,json
try:
    for c in json.load(sys.stdin):
        s=c.get('subdomain')
        if s: print(s)
except: pass
" 2>/dev/null)

# Get all subdomains from webinars
SUBS_WEB=$(curl -s "$API/webinars" 2>/dev/null | python3 -c "
import sys,json
try:
    for w in json.load(sys.stdin):
        s=w.get('subdomain')
        if s: print(s)
except: pass
" 2>/dev/null)

ALL_SUBS=$(echo -e "$SUBS\n$SUBS_WEB" | sort -u | grep -v '^$')

# Build desired domain list
DESIRED_LIST=$(echo -e "streamconferences.com\nwww.streamconferences.com\nadmin.streamconferences.com\napi.streamconferences.com"
for sub in $ALL_SUBS; do echo "${sub}.streamconferences.com"; done
) | sort -u

# Build -d flags
DOMAIN_FLAGS="-d streamconferences.com -d www.streamconferences.com -d admin.streamconferences.com -d api.streamconferences.com"
for sub in $ALL_SUBS; do
    DOMAIN_FLAGS="$DOMAIN_FLAGS -d ${sub}.streamconferences.com"
done

# Get current cert domains
CURRENT_LIST=$(certbot certificates 2>/dev/null | awk -v n="$CERT_NAME" '
    $0 ~ /Certificate Name:/ { cert=$3 }
    cert==n && $0 ~ /Domains:/ { sub(/^.*Domains: */,""); print; exit }
' | tr ' ' '\n' | grep -v '^$' | sort -u)

if [ -z "$CURRENT_LIST" ]; then
    echo "$(date): No existing cert $CERT_NAME found, issuing" >> "$LOG"
    certbot certonly --cert-name "$CERT_NAME" --webroot -w /var/www/certbot --non-interactive --agree-tos --email ganesh@buildyourvision.in $DOMAIN_FLAGS >> "$LOG" 2>&1
    systemctl reload nginx
    echo "$(date): Issued" >> "$LOG"
elif [ "$CURRENT_LIST" != "$DESIRED_LIST" ]; then
    echo "$(date): New domains detected, reissuing" >> "$LOG"
    certbot certonly --cert-name "$CERT_NAME" --expand --force-renewal --webroot -w /var/www/certbot --non-interactive --agree-tos --email ganesh@buildyourvision.in $DOMAIN_FLAGS >> "$LOG" 2>&1
    systemctl reload nginx
    echo "$(date): Reissued" >> "$LOG"
else
    echo "$(date): No changes" >> "$LOG"
fi

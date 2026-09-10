#!/bin/bash
# Auto-SSL for Stream Conferences subdomains
# Runs every 5 minutes via cron to auto-generate SSL for new conference subdomains
# Deploy: copy to /usr/local/bin/auto-ssl-streamconf.sh on server and add cron job

API="http://localhost:7867/api"
CERT_NAME="ai-entrepreneurship.buildyourvision.in"
LOG="/var/log/auto-ssl-streamconf.log"

# Get all subdomains from conferences
SUBS=$(curl -s "$API/conferences" 2>/dev/null | python3 -c "
import sys,json
try:
    data=json.load(sys.stdin)
    for c in data:
        s=c.get('subdomain')
        if s: print(s)
except: pass
" 2>/dev/null)

# Get all subdomains from webinars
SUBS_WEB=$(curl -s "$API/webinars" 2>/dev/null | python3 -c "
import sys,json
try:
    data=json.load(sys.stdin)
    for w in data:
        s=w.get('subdomain')
        if s: print(s)
except: pass
" 2>/dev/null)

ALL_SUBS=$(echo -e "$SUBS\n$SUBS_WEB\nadmin\napi\nstream" | sort -u | grep -v '^$')

# Build -d flags for all subdomains
DOMAIN_FLAGS=""
for sub in $ALL_SUBS; do
    DOMAIN_FLAGS="$DOMAIN_FLAGS -d ${sub}.buildyourvision.in"
done

# Renew consolidated cert with all domains
echo "$(date): Renewing SSL for all domains" >> "$LOG"
certbot certonly --cert-name "$CERT_NAME" --expand $DOMAIN_FLAGS --webroot -w /var/www/certbot --non-interactive --agree-tos --email ganesh@buildyourvision.in >> "$LOG" 2>&1

systemctl reload nginx
echo "$(date): Done" >> "$LOG"

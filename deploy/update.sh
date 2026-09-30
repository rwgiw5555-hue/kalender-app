#!/usr/bin/env bash
# Neue Version vom GitHub-Repo holen, bauen und den Dienst neu starten.
# Aufruf auf dem Server: sudo /opt/kalender/deploy/update.sh
set -euo pipefail
cd /opt/kalender

sudo -u kalender git pull --ff-only
sudo -u kalender npm ci --no-audit --no-fund
# Umgebung (DATABASE_URL usw.) für Prisma laden
sudo -u kalender bash -c 'set -a; . /etc/kalender.env; set +a; npx prisma generate && npx prisma migrate deploy && npm run build'
systemctl restart kalender
systemctl --no-pager --lines=5 status kalender

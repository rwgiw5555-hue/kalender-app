#!/usr/bin/env bash
# Neue Version vom GitHub-Repo holen, bauen und den Dienst neu starten.
#
# Wird bei der Einrichtung nach /usr/local/sbin/kalender-update kopiert (gehört root)
# und von dort aufgerufen: sudo kalender-update
# Nicht direkt aus /opt/kalender starten: Dieser Ordner gehört dem Benutzer kalender,
# und root soll keinen Code ausführen, den dieser Benutzer ändern kann.
set -euo pipefail
cd /opt/kalender

sudo -u kalender git pull --ff-only
# Während npm ci und Build ist die alte Version unvollständig, deshalb kurz anhalten
systemctl stop kalender
sudo -u kalender npm ci --no-audit --no-fund
# Umgebung (DATABASE_URL usw.) für Prisma laden
sudo -u kalender bash -c 'set -a; . /etc/kalender.env; set +a; npx prisma generate && npx prisma migrate deploy && npm run build'
systemctl start kalender
systemctl --no-pager --lines=5 status kalender

if ! cmp -s /opt/kalender/deploy/update.sh "$0"; then
  echo
  echo "Hinweis: deploy/update.sh hat sich geändert. Nach Prüfung übernehmen mit:"
  echo "  install -m 755 -o root -g root /opt/kalender/deploy/update.sh /usr/local/sbin/kalender-update"
fi

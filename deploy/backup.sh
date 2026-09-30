#!/usr/bin/env bash
# Tägliche Sicherung der Datenbank. Läuft als Benutzer kalender per systemd-Timer.
# Behält die letzten 14 Sicherungen in /var/lib/kalender/backups.
set -euo pipefail

DB=/var/lib/kalender/kalender.db
DIR=/var/lib/kalender/backups
KEEP=14

mkdir -p "$DIR"
chmod 700 "$DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
# .backup erstellt eine konsistente Kopie, auch während die App läuft
sqlite3 "$DB" ".backup '$DIR/kalender-$STAMP.db'"
gzip "$DIR/kalender-$STAMP.db"
chmod 600 "$DIR/kalender-$STAMP.db.gz"

ls -1t "$DIR"/kalender-*.db.gz | tail -n +$((KEEP + 1)) | xargs -r rm --

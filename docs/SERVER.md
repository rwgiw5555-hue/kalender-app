# Privater Server für unterwegs

Die App läuft auf einem kleinen Server in Deutschland und ist **nur über Tailscale**
erreichbar, also nur von deinen eigenen Geräten. Der Server hat keinen offenen Port zum
Internet, und niemand sonst kann die Adresse aufrufen.

```
iPhone ──┐                                   ┌─ tailscale serve (HTTPS)
         ├── Tailscale (verschlüsselt) ──────┤        │
PC ──────┘                                   │   127.0.0.1:3000 → Kalender-App
                                             │        │
                                             └─ /var/lib/kalender/kalender.db
```

Kosten: Server ca. 6 €/Monat (Hetzner CX23), Tailscale im Privat-Tarif kostenlos.
Zeitaufwand beim ersten Mal: etwa eine Stunde.

## 1. Tailscale auf PC und iPhone

1. Konto anlegen auf [tailscale.com](https://tailscale.com) (Anmeldung z. B. mit Google
   oder Apple).
2. Tailscale auf dem PC installieren und anmelden.
3. Tailscale-App aus dem App Store aufs iPhone, mit demselben Konto anmelden.
4. In der [Admin-Konsole](https://login.tailscale.com/admin/dns) unter **DNS**:
   **MagicDNS** und **HTTPS Certificates** einschalten. Das braucht die App für HTTPS
   (Homescreen-App, Mikrofon).

## 2. Server anlegen

1. Konto bei [Hetzner Cloud](https://console.hetzner.cloud) anlegen, neues Projekt.
2. **Server hinzufügen:**
   - Standort: Nürnberg oder Falkenstein (Deutschland)
   - Image: Ubuntu 24.04
   - Typ: CX23 (2 vCPU, 4 GB RAM) – kleiner geht auch, aber das Bauen der App braucht
     etwas Speicher
   - SSH-Key: deinen öffentlichen Schlüssel hinterlegen (am PC `ssh-keygen`, dann den
     Inhalt von `~/.ssh/id_ed25519.pub` einfügen)
   - Firewall: neue Firewall **„nur-ssh“** mit einer eingehenden Regel für TCP 22. Die
     Regel löschen wir in Schritt 6 wieder.
3. Server erstellen, IP-Adresse notieren und verbinden:

```bash
ssh root@<IP-ADRESSE>
```

## 3. Grundeinrichtung

Alles folgende auf dem Server als `root`:

```bash
apt update && apt upgrade -y
apt install -y git sqlite3 build-essential ufw unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades   # automatische Sicherheitsupdates: „Ja“

# Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Tailscale; --ssh erlaubt später SSH nur noch über Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --ssh
```

`tailscale up` zeigt einen Link. Im Browser öffnen und den Server deinem Konto
hinzufügen. Danach in der Admin-Konsole beim Server **„Disable key expiry“** wählen,
sonst meldet er sich nach 180 Tagen ab. Den Tailscale-Namen notieren, er sieht so aus:
`kalender.tail1234.ts.net`. Den Server kannst du in der Konsole umbenennen, z. B. in
`kalender`.

## 4. App installieren

```bash
# Eigener Benutzer ohne Login, Daten unter /var/lib/kalender
useradd --system --home-dir /var/lib/kalender --create-home --shell /usr/sbin/nologin kalender
chmod 700 /var/lib/kalender

git clone https://github.com/rwgiw5555-hue/kalender-app.git /opt/kalender
chown -R kalender:kalender /opt/kalender
```

Einstellungen anlegen. `<NAME>` ist der Tailscale-Name aus Schritt 3:

```bash
cat > /etc/kalender.env <<'ENV'
DATABASE_URL=file:/var/lib/kalender/kalender.db
ANTHROPIC_API_KEY=hier-deinen-schlüssel-eintragen
ALLOWED_HOSTS=<NAME>
SHORTCUT_TOKEN=
ENV
chown root:kalender /etc/kalender.env
chmod 640 /etc/kalender.env
nano /etc/kalender.env    # Schlüssel und Namen eintragen, speichern mit Strg+O, Strg+X
```

`SHORTCUT_TOKEN` bleibt vorerst leer; er wird für den Siri-Kurzbefehl gebraucht
(siehe [SIRI.md](SIRI.md)).

`ALLOWED_HOSTS` ist wichtig: Die App lehnt Anfragen ab, die nicht von einer bekannten
Adresse kommen. Ohne diesen Eintrag antwortet sie über Tailscale mit „Nicht erlaubt“.

Bauen, Dienst und tägliche Sicherung einrichten:

```bash
cd /opt/kalender
sudo -u kalender npm ci --no-audit --no-fund
sudo -u kalender bash -c 'set -a; . /etc/kalender.env; set +a; npx prisma generate && npx prisma migrate deploy && npm run build'

cp deploy/kalender.service deploy/kalender-backup.service deploy/kalender-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now kalender kalender-backup.timer
systemctl status kalender     # sollte „active (running)“ zeigen
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/   # sollte 200 sein
```

## 5. HTTPS über Tailscale

```bash
tailscale serve --bg 3000
tailscale serve status
```

Die App ist jetzt unter `https://<NAME>` erreichbar, aber nur für Geräte in deinem
Tailscale-Netz. Test vom PC (mit laufendem Tailscale):

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<NAME>/api/events   # 200
```

Kommt `403`, stimmt `ALLOWED_HOSTS` in `/etc/kalender.env` nicht. Korrigieren, dann
`systemctl restart kalender`.

## 6. Server abschotten

Jetzt, wo alles über Tailscale läuft, wird der Server für das Internet unsichtbar:

1. Testen, dass SSH über Tailscale geht (am PC): `ssh root@<NAME>`
2. Firewall auf dem Server: alles eingehende sperren außer Tailscale.

   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow in on tailscale0
   ufw enable
   ```

3. In der Hetzner-Konsole bei der Firewall **„nur-ssh“** die Regel für Port 22 löschen.
   Die Firewall hat danach keine eingehenden Regeln mehr.
4. Prüfen (am PC, **ohne** Tailscale oder über das Handy im Mobilfunknetz mit
   ausgeschaltetem Tailscale): `ssh root@<IP-ADRESSE>` darf nicht mehr verbinden.

## 7. Auf dem iPhone

1. Tailscale-App einschalten.
2. In Safari `https://<NAME>/heute` öffnen.
3. Teilen-Symbol → **Zum Home-Bildschirm**. Die App startet dann wie eine normale App,
   direkt in „Mein Tag“.
4. Optional: Siri-Kurzbefehl einrichten, siehe [SIRI.md](SIRI.md).

## Updates

Neue Version aus GitHub einspielen:

```bash
ssh root@<NAME>
/opt/kalender/deploy/update.sh
```

Das holt den neuen Stand, spielt Datenbank-Änderungen ein, baut neu und startet die App
neu. Deine Termine bleiben erhalten.

## Sicherungen

- Jeden Tag um 3:30 Uhr legt der Server eine Sicherung in `/var/lib/kalender/backups` ab
  und behält die letzten 14.
- Eine Kopie auf den eigenen PC holen (am PC, mit Tailscale):

  ```bash
  scp root@<NAME>:/var/lib/kalender/backups/*.db.gz ./kalender-backups/
  ```

- Wiederherstellen:

  ```bash
  systemctl stop kalender
  gunzip -c /var/lib/kalender/backups/kalender-<DATUM>.db.gz > /var/lib/kalender/kalender.db
  chown kalender:kalender /var/lib/kalender/kalender.db
  systemctl start kalender
  ```

## Was wo liegt

| Was | Wo |
|---|---|
| App-Code | `/opt/kalender` (aus GitHub, keine persönlichen Daten) |
| Datenbank | `/var/lib/kalender/kalender.db` |
| Sicherungen | `/var/lib/kalender/backups/` |
| Einstellungen und API-Schlüssel | `/etc/kalender.env` (nur root und der Dienst dürfen lesen) |
| Logs | `journalctl -u kalender` |

## Datenschutz

- Die Datenbank liegt auf der Festplatte des Servers bei Hetzner in Deutschland (DSGVO).
  Hetzner gibt die Daten nicht weiter, hat aber technisch Zugriff auf die Hardware.
- Tailscale vermittelt nur die Verbindung. Der Inhalt ist Ende-zu-Ende verschlüsselt,
  Tailscale kann ihn nicht lesen.
- Texte, die du per Spracheingabe oder Freitext einträgst, gehen zum Auswerten an die
  Claude API (Anthropic).

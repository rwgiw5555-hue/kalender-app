# Raspberry Pi als privater Heimserver

Statt eines gemieteten Servers läuft die App auf einem Raspberry Pi bei dir zu Hause. Er ist
**nur über Tailscale** erreichbar, also nur von deinen eigenen Geräten, und hat keinen offenen
Port zum Internet. Deine Daten liegen auf deiner eigenen Hardware. Später können auf demselben
Pi weitere Dienste laufen (Brain, eigener Assistent).

```
iPhone ──┐                                   ┌─ tailscale serve (HTTPS)
         ├── Tailscale (verschlüsselt) ──────┤        │
PC ──────┘                                   │   127.0.0.1:3000 → Kalender-App
                                             │        │
          Raspberry Pi zu Hause (LAN-Kabel)  └─ /var/lib/kalender/kalender.db
```

Die Einrichtung der App selbst ist dieselbe wie in [SERVER.md](SERVER.md). Diese Anleitung
beschreibt, was beim Pi anders ist, und verweist für den Rest dorthin.

## 1. Einkaufsliste

| Teil | Wozu | ca. Preis |
|---|---|---|
| **Raspberry Pi 5, 8 GB** | Rechner; 8 GB, damit später weitere Dienste Platz haben | 90 € |
| **Offizielles Netzteil 27 W (USB-C)** | Schwächere Netzteile führen beim Pi 5 zu Abstürzen | 13 € |
| **Offizieller „Active Cooler“ + Gehäuse, das ausdrücklich für den M.2 HAT+ geeignet ist** (das offizielle Pi-5-Gehäuse mit Lüfter passt nicht) | Dauerbetrieb ohne Überhitzen | 15–25 € |
| **M.2-Adapter („M.2 HAT+“) + NVMe-SSD im Format 2230 oder 2242, 256–512 GB** – am einfachsten das offizielle „Raspberry Pi SSD Kit“ (die üblichen 2280er SSDs passen nicht) | Statt Speicherkarte: hält Dauerbetrieb aus, deutlich schneller | 35–50 € |
| **USB-Gehäuse/Adapter für NVMe-SSD** | Zum Bespielen der SSD am PC (einmalig, danach z. B. für Sicherungen) | 15 € |
| **LAN-Kabel** | Zum Router; stabiler als WLAN | 5 € |
| **Micro-HDMI-auf-HDMI-Kabel** | Notfallzugang mit Bildschirm und Tastatur | 8 € |

Zusammen etwa **150–180 €**. Wichtig ist eine SSD statt Speicherkarte: Speicherkarten gehen bei
Dauerbetrieb oft nach Monaten kaputt.

## 2. Betriebssystem auf die SSD

1. Am PC den **Raspberry Pi Imager** installieren ([raspberrypi.com/software](https://www.raspberrypi.com/software/)).
2. SSD in den USB-Adapter stecken und an den PC anschließen.
3. Im Imager wählen:
   - Gerät: Raspberry Pi 5
   - Betriebssystem: **Raspberry Pi OS Lite (64-bit)** (ohne Desktop, braucht weniger)
   - Speicher: die SSD
4. Bei „Einstellungen anpassen“:
   - Hostname: z. B. `heimserver`
   - Benutzer und ein langes Passwort anlegen
   - **SSH aktivieren, nur mit Schlüssel** (deinen öffentlichen Schlüssel einfügen; am PC
     `ssh-keygen`, dann den Inhalt von `~/.ssh/id_ed25519.pub`)
   - Zeitzone `Europe/Berlin`, Tastatur `de`
   - WLAN leer lassen (LAN-Kabel)
5. Schreiben, SSD in den M.2-Adapter am Pi einbauen, LAN-Kabel und Netzteil anschließen.

Der Pi 5 startet von der SSD, wenn keine Speicherkarte steckt. Startet er nicht (ältere
Firmware): mit dem Imager zusätzlich Raspberry Pi OS Lite auf eine Speicherkarte schreiben und
einmal davon starten. Dort `sudo rpi-eeprom-update -a` und `sudo reboot`, danach
`sudo raspi-config` → *Advanced Options* → *Boot Order* → *NVMe/USB Boot*. Ausschalten,
Karte raus, neu starten.

## 3. Verbinden und Grundeinrichtung

Vorher **Abschnitt 1 „Tailscale auf PC und iPhone“ aus [SERVER.md](SERVER.md)** erledigen
(Konto, Apps, MagicDNS und HTTPS Certificates einschalten). Ohne das gibt es später kein HTTPS
und der Name `heimserver` wird nicht gefunden.

Am PC im selben Heimnetz:

```bash
ssh <BENUTZER>@heimserver.local
sudo -i          # ab hier als root, wie in SERVER.md
```

Dann **Abschnitt 3 „Grundeinrichtung“ aus [SERVER.md](SERVER.md)** ausführen (Updates,
Node.js 22, Tailscale mit `tailscale up --ssh`, „Disable key expiry“). Alles davon gibt es auch
für den Pi; Node.js und Tailscale erkennen die ARM-Architektur selbst. Unterschiede:

- Den Tipp, den Server in der Tailscale-Konsole umzubenennen, **überspringen**: Die Befehle
  hier gehen vom Namen `heimserver` aus.
- Automatische Updates: Auf Raspberry Pi OS spielt `unattended-upgrades` nur Debian-Updates ein,
  nicht Kernel und Firmware des Pi. Deshalb in `/etc/apt/apt.conf.d/50unattended-upgrades` unter
  `Unattended-Upgrade::Origins-Pattern` diese Zeile ergänzen:

  ```
  "origin=Raspberry Pi Foundation,codename=${distro_codename},label=Raspberry Pi Foundation";
  ```

  Zusätzlich etwa einmal im Monat `apt update && apt full-upgrade -y` und danach `reboot`.

Wichtig: **Im Router keine Portfreigabe einrichten.** Der Pi braucht keinen Zugang von außen;
alles läuft über Tailscale.

## 4. App, HTTPS, iPhone

Wie in [SERVER.md](SERVER.md):

- **Abschnitt 4 „App installieren“** (Benutzer `kalender`, `/etc/kalender.env`, Bauen,
  Dienst, tägliche Sicherung). Das Bauen dauert auf dem Pi einige Minuten.
- **Abschnitt 5 „HTTPS über Tailscale“**
- **Abschnitt 7 „Auf dem iPhone“**

## 5. Abschotten

Statt der Hetzner-Firewall aus SERVER.md Abschnitt 6:

1. Über Tailscale verbinden (am PC): `ssh root@heimserver`. Beim ersten Mal öffnet sich ein
   Browser-Link zur Bestätigung, das ist normal.
2. **In dieser Tailscale-Sitzung** (nicht über `heimserver.local`) die Firewall einrichten: nur
   Tailscale darf rein. Bei `ufw enable` die Rückfrage mit `y` bestätigen.

   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow in on tailscale0
   ufw enable
   ```

3. Prüfen: `ssh <BENUTZER>@heimserver.local` aus dem Heimnetz ohne Tailscale darf nicht mehr
   verbinden.

Notfallzugang, falls Tailscale nicht mehr geht: Bildschirm (Micro-HDMI) und Tastatur direkt am
Pi, mit Benutzer und Passwort aus dem Imager anmelden, dann z. B. `sudo tailscale up --ssh`.

## 6. Sicherungen außer Haus

Die tägliche Sicherung liegt zunächst auf dem Pi selbst. Fällt er aus oder wird gestohlen, ist
sie mit weg. Deshalb regelmäßig eine Kopie holen (am PC, mit Tailscale):

```bash
scp root@heimserver:/var/lib/kalender/backups/*.db.gz ./kalender-backups/
```

Eine automatische, verschlüsselte Sicherung (z. B. auf eine externe Platte oder einen zweiten
Ort) richten wir ein, sobald mehr Daten auf dem Pi liegen (Brain).

## Updates, Sicherungen wiederherstellen, Was wo liegt

Genau wie in [SERVER.md](SERVER.md): `kalender-update` für neue Versionen, Wiederherstellen
aus `/var/lib/kalender/backups`, Logs mit `journalctl -u kalender`.

## Datenschutz und bekannte Lücken

- Die Datenbank liegt bei dir zu Hause, kein Hosting-Anbieter hat Zugriff.
- Tailscale vermittelt nur die Verbindung, der Inhalt ist Ende-zu-Ende verschlüsselt.
- Texte und Dateien, die du auswerten lässt, gehen an die Claude API (Anthropic).
- **Lücke: Die SSD ist nicht verschlüsselt.** Wer den Pi mitnimmt, kann die Daten lesen.
  Eine Verschlüsselung würde verhindern, dass der Pi nach einem Stromausfall von selbst wieder
  startet (das Passwort müsste jedes Mal eingegeben werden). Den Pi deshalb nicht offen
  herumstehen lassen; über eine Lösung entscheiden wir, bevor das Brain darauf kommt.
- **Lücke: Strom und Internet zu Hause.** Fällt beides aus, ist die App unterwegs nicht
  erreichbar. Nach einem Stromausfall startet der Pi und die App von selbst wieder.

# Kalender

Persönlicher Kalender mit Routinen, Aufgaben zum Abhaken und Spracheingabe. Läuft auf dem
eigenen PC oder einem privaten Server und ist fürs iPhone als Homescreen-App gedacht.

- **Drei Stile** zum Auswählen (Einstellungen): A „Klar & ruhig“ (hell), B „Dunkel & fokussiert“,
  C „Farbig & freundlich“, jeweils mit eigener Akzentfarbe.
- **Kalender** (`/`): Woche, Monat, Tag. Am PC mit Seitenleiste (Schnelleingabe, Mini-Monat,
  „Mein Tag“ zum Abhaken), auf dem Handy mit Tab-Leiste. Termine per Klick, Drag & Drop oder Dialog.
- **Routinen:** Termine mit Wiederholung (täglich, werktags, wöchentlich, alle 2 Wochen,
  monatlich, jährlich, optional mit Enddatum).
- **Mein Tag** (`/heute`): Fortschritt, Termine des Tages, Schritte der Routinen und Aufgaben
  zum Abhaken; auf dem Handy einspaltig, am PC zweispaltig.
- **Spracheingabe:** „Morgen 14 Uhr Zahnarzt“ oder „Jeden Montag 18 Uhr aufräumen“ wird
  über die Claude API zu einem Vorschlag, den du vor dem Speichern prüfst und bearbeitest.
  Mit dem Schalter „KI darf Termine sehen“ (Einstellungen, Standard aus) versteht sie
  auch „verschieb den Zahnarzt auf Freitag“ oder „Zahnarzt absagen“. Auf dem iPhone per
  Diktier-Taste oder Siri-Kurzbefehl.

## Starten auf dem PC

Voraussetzung: [Node.js](https://nodejs.org) 22.12 oder neuer.

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env – dann ANTHROPIC_API_KEY eintragen
npx prisma migrate deploy     # legt die Datenbank dev.db an bzw. bringt sie auf den neuen Stand
npm run dev
```

Dann <http://127.0.0.1:3000> öffnen. Unter Windows startet `start.bat` die App und den
Browser.

Nach einem `git pull` immer `npm install` und `npx prisma migrate deploy` ausführen. Deine
Termine bleiben dabei erhalten. Sieht die App danach noch teilweise alt aus (falsche Farben,
alte Schriften), die App stoppen, den Ordner `.next` löschen (Zwischenspeicher, wird neu
erzeugt) und neu starten.

## Einstellungen (`.env`)

| Name | Wofür |
|---|---|
| `ANTHROPIC_API_KEY` | Schlüssel für die Claude API (Spracheingabe) |
| `DATABASE_URL` | Pfad zur Datenbank, Standard `file:./dev.db` |
| `ALLOWED_HOSTS` | Zusätzliche erlaubte Adressen, z. B. der Tailscale-Name des Servers |
| `SHORTCUT_TOKEN` | Geheimer Schlüssel für den Siri-Kurzbefehl, mind. 32 Zeichen (leer oder kürzer = aus) |

`.env` und die Datenbank werden nie ins Repo übernommen.

## Sicherheit

- Die App ist nur auf dem eigenen Rechner erreichbar (`127.0.0.1`), nicht im WLAN.
- Für unterwegs läuft sie auf einem privaten Server, den nur deine Geräte über Tailscale
  erreichen ([docs/SERVER.md](docs/SERVER.md)).
- Alle Eingaben werden geprüft; Anfragen von fremden Webseiten werden abgelehnt.
- Regeln für Änderungen am Code stehen in [CLAUDE.md](CLAUDE.md).

## Dokumentation

- [docs/ROADMAP.md](docs/ROADMAP.md): Plan und Hintergründe
- [docs/SERVER.md](docs/SERVER.md): privaten Server einrichten
- [docs/SIRI.md](docs/SIRI.md): Siri-Kurzbefehl einrichten

## Technik

Next.js 16, React 19, Prisma mit SQLite, FullCalendar mit `@fullcalendar/rrule`,
Tailwind CSS, Claude API (`@anthropic-ai/sdk`).

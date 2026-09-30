# Roadmap

Anleitungen: [Server einrichten](SERVER.md) · [Siri-Kurzbefehl](SIRI.md)

**Stand 30.09.2026:** Alle Stufen sind umgesetzt. Offen ist nur, was sich hier nicht testen
ließ: Server tatsächlich einrichten, Siri-Kurzbefehl auf dem iPhone, Spracheingabe mit
echtem API-Schlüssel.

Ziel: ein eigener Tagesplaner mit festen Routinen, Aufgaben zum Abhaken und
Sprachbedienung, der auf dem iPhone läuft. Termine bleiben privat und gehen an keine
Dritten außer den bewusst gewählten (siehe [Datenschutz](#datenschutz)).

Die Reihenfolge ist so gewählt, dass jede Stufe für sich nutzbar ist. Zu jedem Punkt gibt
es ein Issue.

## 1. Routinen (wiederkehrende Termine)

Issue: #2

**Was:** Termine wie „jeden Montag 18 Uhr Aufräumen“ oder „werktags 7 Uhr Morgenroutine“.

**Wie:**
- Neues optionales Feld `rrule` (Text) am Modell `Event` in `prisma/schema.prisma` plus
  Migration.
- Anzeige über das FullCalendar-Plugin
  [`@fullcalendar/rrule`](https://fullcalendar.io/docs/rrule-plugin) (passend zur
  vorhandenen Version 6.1.21). Die Regel wird als Objekt mit `freq`, `byweekday`,
  `dtstart` usw. übergeben, das lässt sich direkt als JSON speichern.
- `EventModal.tsx`: Auswahl „Wiederholen: nie / täglich / werktags / wöchentlich / monatlich“.
- `/api/parse-event`: Claude erkennt Wiederholungen im Satz und liefert die Regel mit.
- `lib/validation.ts`: nur erlaubte Regel-Felder und Werte durchlassen.
- Offene Frage: einzelne Vorkommen verschieben oder auslassen (Ausnahmen). Für den Anfang
  reicht „ganze Serie bearbeiten“.
- Achtung: Es gibt einen bekannten Fall, in dem das Plugin mit Next.js nicht lud
  ([Issue #7260](https://github.com/fullcalendar/fullcalendar/issues/7260)). Das zuerst in
  einem kleinen Test prüfen.

## 2. Aufgaben und Checklisten

Issue: #3

**Was:** Dinge ohne feste Uhrzeit zum Abhaken, z. B. „Küche aufräumen“, „Wäsche“. Optional
als Teil einer Routine (Morgenroutine = Liste von Schritten).

**Wie:**
- Neues Modell `Task` (Titel, erledigt am, optional Datum, optional Verknüpfung zu einem
  Routine-Termin, Reihenfolge).
- API-Routen `/api/tasks` mit derselben Eingabeprüfung wie bei Terminen.
- Wiederkehrende Aufgaben werden pro Tag als „offen“ angezeigt und pro Tag abgehakt
  (Erledigungen als eigene Einträge speichern, nicht die Aufgabe selbst ändern).

## 3. „Heute“-Ansicht fürs Handy

Issue: #4

**Was:** Eine Startseite für den Tag: nächste Termine, heutige Routinen mit ihren Schritten,
offene Aufgaben mit großen Haken zum Antippen. Die Wochenansicht bleibt für den PC.

**Wie:**
- Neue Seite `app/heute/page.tsx`, mobil zuerst gestaltet, große Tippflächen.
- Die bestehende Uhr und das Eingabefeld (`NaturalInput`) oben übernehmen.

## 4. Als App auf dem iPhone-Homescreen

Issue: #5

**Was:** Die Web-App lässt sich über „Zum Home-Bildschirm“ wie eine App starten.

**Wie:**
- `app/manifest.ts` (Name, Icons, `display: standalone`, Startseite `/heute`) und
  App-Icons in `public/`.
- Voraussetzung ist HTTPS, das liefert Stufe 6.

## 5. Sprachbedienung auf dem iPhone

Issue: #6

**Problem:** Die Browser-Spracherkennung (`webkitSpeechRecognition`), die `NaturalInput`
heute nutzt, funktioniert in einer vom Homescreen gestarteten Web-App auf dem iPhone nicht
([MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)).

**Lösung in zwei Teilen:**
- **Diktier-Taste der iPhone-Tastatur:** funktioniert in jedem Textfeld, also auch im
  vorhandenen Eingabefeld. Nichts zu programmieren, nur den Mikrofon-Knopf ausblenden, wenn
  die Browser-Erkennung fehlt (macht der Code schon).
- **Siri-Kurzbefehl „Termin eintragen“:** Ein Kurzbefehl fragt per Diktat nach dem Text
  und schickt ihn mit „Inhalte von URL abrufen“ (POST, JSON) an die App
  ([Apple: API in Kurzbefehlen](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios)).
  Dafür braucht die App einen Endpunkt, der Text parst **und** speichert, abgesichert über
  ein geheimes Token im Header (steht in `.env`, nie im Repo). Die Antwort („Zahnarzt am
  Donnerstag 14 Uhr eingetragen“) kann Siri vorlesen.

## 6. Privater Server für unterwegs

Issue: #7

**Anforderung:** Erreichbar vom iPhone, auch wenn der PC aus ist. Keine öffentliche Adresse,
keine Weitergabe der Termine.

**Empfehlung:** Ein kleiner Cloud-Server in Deutschland, der **nur über Tailscale**
erreichbar ist.
- Server z. B. Hetzner CX23 (Standort Deutschland, ca. 6 €/Monat,
  [Preise](https://www.hetzner.com/cloud/regular-performance/)).
- [Tailscale](https://tailscale.com/pricing) (Privat-Tarif kostenlos) auf Server, PC und
  iPhone. Der Server bekommt keinen offenen Port zum Internet, die Firewall blockt alles
  außer Tailscale.
- HTTPS mit echtem Zertifikat über
  [`tailscale serve`](https://tailscale.com/docs/features/tailscale-serve). Damit
  funktionieren auch Homescreen-App und Mikrofon.
- Die App läuft dort mit `npm run start` (nur `127.0.0.1`), `tailscale serve` leitet weiter.
  Den Tailscale-Namen des Servers in `ALLOWED_HOSTS` eintragen, sonst blockt die App die
  Anfragen.
- Tägliches verschlüsseltes Backup der Datenbank.
- Der Anbieter hostet die Festplatte, bekommt die Daten aber nicht weitergegeben, und die
  Server stehen in Deutschland (DSGVO).

**Alternative ganz ohne Cloud-Anbieter:** Raspberry Pi zu Hause mit Tailscale. Einmalig ca.
80–100 €, dafür liegt alles bei dir. Nachteil: Strom- oder Internetausfall zu Hause = App weg.

**Nicht empfohlen:** Öffentliches Hosting (z. B. Vercel). Die App wäre aus dem ganzen
Internet erreichbar und bräuchte ein eigenes Login-System, die Daten lägen bei einem
US-Anbieter.

## Datenschutz

Wer bekommt welche Daten zu sehen:

| Weg | Wer sieht es | Abschaltbar? |
|---|---|---|
| Termine speichern und anzeigen | nur dein Server | – |
| Text in natürlicher Sprache auswerten (`/api/parse-event`) | Anthropic (Claude API). API-Daten werden nicht zum Training verwendet. | Ja: Formular statt Freitext nutzen |
| Diktat auf dem iPhone | Apple (Siri/Diktat) | Ja: tippen statt sprechen |
| Browser-Spracherkennung in Chrome am PC | Google | Ja: tippen statt sprechen |
| Verbindung Handy ↔ Server | Tailscale vermittelt nur, die Daten sind Ende-zu-Ende verschlüsselt | – |

Optional später: einfacher lokaler Parser für Standardsätze („morgen 14 Uhr Zahnarzt“), damit
nur schwierige Sätze an Claude gehen.

## Aufräumen nebenbei

Issue: #8

- Die 5 vorhandenen Lint-Meldungen beheben (`app/page.tsx`, `components/NaturalInput.tsx`,
  `components/Calendar.tsx`).
- `README.md` ist noch die Next.js-Vorlage: durch eine kurze Anleitung ersetzen (Start,
  `.env`, Sicherheit).
- Content-Security-Policy ergänzen und testen.
- Beim Verschieben per Drag & Drop Fehler anzeigen statt still zurückspringen.

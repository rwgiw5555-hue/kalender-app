# Termine per Siri eintragen

Mit einem Kurzbefehl sagst du „Hey Siri, Termin eintragen“, diktierst den Termin, und
Siri liest die Bestätigung vor, z. B. „Zahnarzt am Donnerstag, 1. Oktober um 14:00
eingetragen.“

Beginnt der Satz mit **„Aufgabe“**, **„To-do“** oder **„Erinnere mich an“**, wird daraus
eine Aufgabe für heute statt eines Termins: „Aufgabe Milch kaufen“.

## Voraussetzungen

- Die App läuft auf dem privaten Server (siehe [SERVER.md](SERVER.md)). Vom PC aus
  (`npm run dev`) ist sie für das iPhone nicht erreichbar.
- Tailscale ist auf dem iPhone eingeschaltet. Damit das auch unterwegs automatisch klappt:
  in der Tailscale-App unter **Einstellungen** „VPN On Demand“ aktivieren.

## 1. Geheimen Schlüssel anlegen

Der Kurzbefehl meldet sich mit einem geheimen Schlüssel an. Ohne Schlüssel ist dieser Zugang
abgeschaltet.

Auf dem Server:

```bash
openssl rand -hex 32            # erzeugt einen zufälligen Schlüssel, kopieren
nano /etc/kalender.env          # Zeile SHORTCUT_TOKEN=<schlüssel> ergänzen
systemctl restart kalender
```

Den Schlüssel nirgends sonst speichern und nicht ins Repo schreiben. Er steht nur in
`/etc/kalender.env` und im Kurzbefehl auf deinem iPhone.

## 2. Kurzbefehl auf dem iPhone erstellen

Kurzbefehle-App öffnen, oben rechts **+**, dann nacheinander diese Aktionen hinzufügen
(über das Suchfeld „Aktion suchen“):

1. **Text diktieren**
   - Sprache: Deutsch
   - Zuhören beenden: „Nach kurzer Pause“
2. **Inhalte von URL abrufen**
   - URL: `https://<NAME>/api/shortcut` (`<NAME>` = Tailscale-Name des Servers, z. B.
     `kalender.tail1234.ts.net`)
   - Auf den Pfeil tippen, um die Optionen zu öffnen:
     - Methode: **POST**
     - Header hinzufügen: Schlüssel `Authorization`, Text `Bearer <SCHLÜSSEL>` (mit
       Leerzeichen nach „Bearer“)
     - Anfragetext: **JSON**, Feld hinzufügen → Typ **Text**, Schlüssel `text`, Wert: die
       Variable **Diktierter Text** (aus Schritt 1 auswählen)
3. **Wörterbuchwert abrufen**
   - Wert für `message` in **Inhalte von URL** abrufen
4. **Text sprechen**
   - Text: **Wörterbuchwert** (aus Schritt 3)

Oben den Namen des Kurzbefehls auf **„Termin eintragen“** ändern. Dieser Name ist auch der
Satz für Siri.

## 3. Ausprobieren

„Hey Siri, Termin eintragen“, dann z. B.:

- „Morgen um 14 Uhr Zahnarzt“
- „Jeden Montag um 18 Uhr aufräumen“
- „Werktags um 7 Uhr Morgenroutine“
- „Aufgabe Wäsche aufhängen“

## Wenn etwas nicht klappt

| Siri sagt | Ursache |
|---|---|
| „Zugriff verweigert.“ | Schlüssel im Kurzbefehl stimmt nicht mit `SHORTCUT_TOKEN` überein, oder „Bearer “ fehlt |
| „Der Kurzbefehl ist nicht eingerichtet.“ | `SHORTCUT_TOKEN` fehlt auf dem Server oder ist kürzer als 32 Zeichen |
| Fehler „Nicht erlaubt“ oder gar keine Antwort | Tailscale auf dem iPhone ist aus, oder der Name fehlt in `ALLOWED_HOSTS` |
| „Das habe ich nicht als Termin verstanden …“ | Satz war unklar; nochmal mit Datum und Uhrzeit sagen |
| „Der Kalender kann den Text gerade nicht auswerten.“ | Claude API nicht erreichbar oder `ANTHROPIC_API_KEY` fehlt |

## Datenschutz

Der diktierte Text geht an Apple (Siri-Diktat) und zum Auswerten an die Claude API
(Anthropic). Gespeichert wird der Termin nur auf deinem Server.

## In der App selbst

In der Homescreen-App blendet iOS die Spracherkennung des Browsers aus. Im Eingabefeld von
„Mein Tag“ funktioniert aber die **Mikrofon-Taste der iPhone-Tastatur**: ins Feld tippen,
Mikrofon unten rechts auf der Tastatur, sprechen, „Hinzufügen“.

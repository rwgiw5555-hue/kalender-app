@AGENTS.md

# Sicherheitsregeln

Diese Regeln gelten für jede Änderung an diesem Projekt.

- **Keine persönlichen Daten im Repo.** Datenbanken (`*.db`), Exporte und Backups werden nie committet. Das Repo ist öffentlich.
- **Keine Schlüssel im Repo.** API-Keys stehen nur in `.env` (ignoriert). `.env.example` enthält nur leere Platzhalter.
- **Server nur privat erreichbar.** `npm run dev` und `npm run start` lauschen nur auf `127.0.0.1`. Zugriff von anderen Geräten nur über ein privates Netz (z. B. Tailscale), nie über einen offenen Port oder eine öffentliche Adresse.
- **Alle Eingaben prüfen.** API-Routen übernehmen nie den Request-Body direkt in die Datenbank, sondern prüfen ihn über `lib/validation.ts`.
- **Keine neuen Drittanbieter ohne Rückfrage.** Jeder Dienst, der Termine oder Eingaben zu sehen bekommt (Hosting, KI, Analyse, Sync), muss vorher mit Robert abgestimmt werden. Aktuell bekommt nur die Claude API (Anthropic) den eingegebenen Text und zum Import ausgewählte Dateien (PDF, Fotos) zum Auswerten, und nur wenn der Nutzer „KI darf Termine und Aufgaben sehen“ einschaltet, zusätzlich Titel, Zeiten, Kategorie und Wiederholung der Termine von 14 Tagen zurück bis 60 Tage voraus (nie Beschreibungen) sowie Titel, Datum und Wiederholung der offenen Aufgaben (ohne Schritte von Routinen).
- **KI-Vorschläge nie direkt ausführen.** Was Claude aus Text macht, ist ein Vorschlag: Er wird wie jede Eingabe geprüft und erst nach Bestätigung durch den Nutzer gespeichert. Ändern/Löschen nur für Termin-IDs, die Claude im Kontext gezeigt wurden.
- **Keine Tracking- oder Analyse-Skripte.**

## Arbeitsweise (aus Roberts „Brain“)

- **Neue Abhängigkeiten sind fremder Code mit vollen Rechten.** npm-Pakete, Skripte und Erweiterungen nur von bekannten Anbietern und nur nach Rückfrage. Vorher prüfen: Was schreibt es wohin, lädt es etwas nach, hat es Install-Skripte?
- **Erst lesen, dann ausführen.** Fremde Skripte und Befehle werden vor dem Start gelesen und kurz erklärt.
- **Ein Commit ist praktisch nicht löschbar.** Vor jedem Commit prüfen, was mitkommt (`git add -A --dry-run`). Ist doch ein Geheimnis im Verlauf gelandet, gilt es als verbrannt: Schlüssel sofort erneuern, das Entfernen der Datei reicht nicht.
- **Geheimnisse nie ausgeben.** Weder im Chat noch in Logs, Fehlermeldungen oder Doku. Zum Prüfen nur „vorhanden ja/nein“ und die Form, nie den Wert.
- **Sicherung vor jedem Eingriff in Daten.** Vor Migrationen, Umrechnungen oder Löschungen wird die Datenbank außerhalb des Repos kopiert. Destruktive Befehle (`prisma migrate reset`, `prisma db push` mit Datenverlust, `git reset --hard`, `git clean`, Force-Push) nur nach ausdrücklicher Zustimmung.
- **Private Daten bleiben lokal.** Termine, Backups und Exporte liegen nicht auf fremden Servern, auch nicht in privaten Repos oder Cloud-Speichern, außer nach Absprache (abgestimmt ist bisher nur die Claude API wie oben beschrieben). Der eigene Server aus `docs/SERVER.md` ist so eine Absprache und wird erst nach Roberts Zustimmung eingerichtet.
- **Lücken benennen statt Schutz vortäuschen.** Eine Sicherheitsmaßnahme, die nur behauptet wird, ist schlechter als eine dokumentierte Lücke.
- **Bei Unsicherheit fragen, nicht raten.**

## Bekannte, bewusst akzeptierte Lücken

- **Spracherkennung des Browsers.** Die Mikrofon-Taste nutzt die Web Speech API. Der Browser schickt den Ton zur Erkennung an seinen Hersteller (Chrome: Google, Edge: Microsoft, Safari: Apple, teils auf dem Gerät). Robert hat das bewusst akzeptiert; die Einstellungen weisen darauf hin. Alternative ohne diesen Weg: tippen oder die Diktierfunktion des Geräts. Kein weiterer Dienst darf Ton oder Text bekommen.

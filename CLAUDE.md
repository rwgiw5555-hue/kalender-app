@AGENTS.md

# Sicherheitsregeln

Diese Regeln gelten für jede Änderung an diesem Projekt.

- **Keine persönlichen Daten im Repo.** Datenbanken (`*.db`), Exporte und Backups werden nie committet. Das Repo ist öffentlich.
- **Keine Schlüssel im Repo.** API-Keys stehen nur in `.env` (ignoriert). `.env.example` enthält nur leere Platzhalter.
- **Server nur privat erreichbar.** `npm run dev` und `npm run start` lauschen nur auf `127.0.0.1`. Zugriff von anderen Geräten nur über ein privates Netz (z. B. Tailscale), nie über einen offenen Port oder eine öffentliche Adresse.
- **Alle Eingaben prüfen.** API-Routen übernehmen nie den Request-Body direkt in die Datenbank, sondern prüfen ihn über `lib/validation.ts`.
- **Keine neuen Drittanbieter ohne Rückfrage.** Jeder Dienst, der Termine oder Eingaben zu sehen bekommt (Hosting, KI, Analyse, Sync), muss vorher mit Robert abgestimmt werden. Aktuell bekommt nur die Claude API (Anthropic) den eingegebenen Text zum Auswerten, und nur wenn der Nutzer „KI darf Termine sehen“ einschaltet, zusätzlich Titel, Zeiten, Kategorie und Wiederholung der Termine von 14 Tagen zurück bis 60 Tage voraus (nie Beschreibungen).
- **KI-Vorschläge nie direkt ausführen.** Was Claude aus Text macht, ist ein Vorschlag: Er wird wie jede Eingabe geprüft und erst nach Bestätigung durch den Nutzer gespeichert. Ändern/Löschen nur für Termin-IDs, die Claude im Kontext gezeigt wurden.
- **Keine Tracking- oder Analyse-Skripte.**

<!-- Hier Roberts eigene Sicherheitsregeln aus dem „Brain“ ergänzen. -->

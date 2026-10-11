# Kalender 📅

Ein schlichter, moderner Kalender mit eingebautem Chat-Assistenten. Läuft im Browser auf dem Handy (iPhone/Android) und auf dem Windows-Laptop – ohne Installation, auch offline.

## Was der Assistent kann

Schreib (oder sprich 🎤) einfach ganz normal:

| Du sagst | Er macht |
|---|---|
| „Mathe-Prüfung am Freitag um 10 Uhr im Zimmer 204“ | Termin mit Kategorie *Prüfung* und Ort eintragen |
| „Jeden Dienstag von 18 bis 19:30 Unihockey-Training“ | Wöchentliche Serie |
| „Montag Franz-Test und Mittwoch Bio-Vortrag“ | Zwei Termine auf einmal |
| „Erinnere mich morgen um 7 an die Turnsachen“ | Termin mit Erinnerung |
| „Was habe ich diese Woche?“ / „Habe ich morgen eine Prüfung?“ | Übersicht |
| „Welche Prüfungen kommen?“ / „Welche Hausaufgaben sind offen?“ | Nach Kategorie filtern |
| „Verschiebe Zahnarzt auf Donnerstag 15 Uhr“ / „Kino eine Stunde später“ | Verschieben |
| „Lösche das Training morgen“ | Löschen (mit Rückgängig) |
| „Wann habe ich morgen Nachmittag Zeit?“ | Freie Zeitfenster finden |
| „Wie lange noch bis zur Mathe-Prüfung?“ | Countdown |
| „Erstelle einen Lernplan für die Bio-Prüfung“ | 3 Lerneinheiten in freien Zeiten vor der Prüfung |
| „Englisch-Hausaufgabe erledigt“ | Abhaken |
| „Rückgängig“ | Letzte Änderung zurücknehmen |

Der eingebaute Assistent funktioniert **offline und gratis**. Optional kannst du in den Einstellungen einen **Anthropic-API-Schlüssel** eintragen – dann versteht Claude auch komplizierte Sätze.

## Weitere Funktionen

- Monat-, Wochen- und Listenansicht, Wischen zum Blättern
- 7 Farb-Kategorien (Schule, Prüfung, Hausaufgabe, Sport, Freizeit, Termin, Sonstiges)
- Erinnerungen als Benachrichtigung
- Hell/Dunkel-Modus
- Sichern/Wiederherstellen (.json) und Export als .ics (für Google/Outlook/Apple-Kalender)
- Tastenkürzel am Laptop: `N` neuer Termin, `T` heute, `/` Chat, `←` `→` blättern, `M` `W` `L` Ansicht

## Online stellen (GitHub Pages, gratis)

1. Auf GitHub im Repository: **Settings → Pages**
2. Bei *Source* „Deploy from a branch“ wählen, den Branch (z.B. `main`) und Ordner `/ (root)` auswählen, **Save**
3. Nach ca. 1 Minute ist die App unter `https://<dein-name>.github.io/Kalender-App/` erreichbar

### Als App installieren

- **iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm“
- **Android (Chrome):** Menü ⋮ → „App installieren“
- **Windows (Edge/Chrome):** Installieren-Symbol in der Adresszeile

## Gut zu wissen

- Termine werden **auf dem jeweiligen Gerät** gespeichert. Um sie zwischen Handy und Laptop zu übertragen: Einstellungen → *Sichern* und auf dem anderen Gerät *Wiederherstellen*.
- Erinnerungen erscheinen, solange die App (oder der Tab) geöffnet ist.
- Lokal testen: `python -m http.server` im Ordner starten und `http://localhost:8000` öffnen.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt. `js/vendor/anthropic-sdk.mjs` ist das offizielle Anthropic-TypeScript-SDK (v0.128.0), als eine Datei gebündelt.

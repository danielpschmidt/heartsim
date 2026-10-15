# AuraMind – Deployment auf klassischem PHP/MySQL-Webhosting

## Architektur

- `backend/` – reines PHP (kein Framework, kein Composer nötig), spricht mit MySQL über PDO. Läuft auf praktisch jedem Shared-Hoster mit PHP ≥ 8.0 und MySQL/MariaDB.
- `frontend/` – Vite-Projekt (Vanilla JS + Tailwind). `npm run build` erzeugt ein statisches `dist/`-Verzeichnis, das per FTP/SFTP hochgeladen wird.

Empfohlen: Frontend und Backend unter **derselben Domain** deployen (Backend unter `/api`), dann sind keine CORS-Klimmzüge nötig und die Session-Cookies funktionieren ohne Zusatzaufwand.

```
deindomain.de/
├── index.html          (Homepage, aus frontend/dist/)
├── app/index.html      (die App, aus frontend/dist/app/)
├── home/...            (Screenshots der Homepage, aus frontend/dist/home/)
├── assets/...           (aus frontend/dist/)
└── api/                (kompletter Inhalt von backend/)
    ├── config.php
    ├── lib/
    └── ...
```

## 1. Datenbank anlegen

Im Hoster-Kontrollpanel (Plesk/cPanel/etc.) eine MySQL-Datenbank + Benutzer anlegen, dann:

```
mysql -u DEIN_USER -p DEIN_DB_NAME < backend/schema.sql
```
cyon:  blogcrmc_health erstellt. Dessen Passwort lautet: Ya;6QE?8sAu+7Y

(oder Datei-Upload über phpMyAdmin → Importieren).

Das Schema legt eine Standard-Admin-PIN `admin2026` an. **Nach dem ersten Login im Admin-Bereich sofort ändern.**

## 2. Backend konfigurieren

```
cp backend/config.example.php backend/config.php
```

`config.php` ausfüllen: DB-Zugangsdaten, `app_key` (z.B. `php -r "echo bin2hex(random_bytes(32));"`), `force_https_cookies` auf `true` lassen (setzt voraus, dass die Seite nur über HTTPS läuft – bei den meisten Hostern per Let's Encrypt gratis).

`config.php` NIE ins Repository committen (ist bereits in `.gitignore`).

## 3. Backend hochladen

Gesamten Inhalt von `backend/` per FTP/SFTP z.B. nach `deindomain.de/api/` hochladen. Die mitgelieferten `.htaccess`-Dateien sperren `config.php`, `schema.sql` und den `lib/`-Ordner gegen direkten Web-Zugriff (Apache mit `mod_rewrite`/`mod_authz_core` vorausgesetzt – bei den meisten Hostern Standard).

Falls dein Hoster es erlaubt, `backend/` stattdessen **oberhalb** des öffentlichen `htdocs`/`public_html`-Ordners ablegen und nur die Endpunkte per Reverse-Include erreichbar machen – das ist die sicherste Variante, aber auf reinem Shared-Hosting selten möglich. Die `.htaccess`-Regeln sind der praxistaugliche Kompromiss dafür.

## 4. Frontend bauen & hochladen

```
cd frontend
cp .env.example .env
# .env leer lassen, wenn Backend unter derselben Domain unter /api liegt
npm install
npm run build
```

Inhalt von `frontend/dist/` in den Webroot (`deindomain.de/`) hochladen.

Für lokale Entwicklung: `npm run dev` startet Vite mit Proxy auf `http://127.0.0.1:8098` (siehe `vite.config.js`) – parallel dazu lokal `php -S 127.0.0.1:8098 -t backend` laufen lassen.

## 5. Admin-Zugang & Gemini API-Key

1. `deindomain.de/#` → Tab „Admin“ → mit `admin2026` einloggen.
2. Sofort eine neue, individuelle PIN setzen (Feld „Neue Admin-PIN“).
3. Optional: Google-Gemini-API-Key eintragen. Der Key wird ausschließlich serverseitig in der Datenbank gespeichert und verlässt das Backend nie in Richtung Browser – die App zeigt im Admin-Bereich nur eine maskierte Vorschau.

Ohne hinterlegten Key läuft der Coach automatisch mit der eingebauten lokalen Regel-Engine (keine externen Anfragen).

## Klinisch fundierte Methoden, die eingebaut sind

- **Sicherheitsplan (Stanley-Brown-Modell / Safety Planning Intervention)** — über den 🛡️-Button im Header jederzeit erreichbar. 6 Schritte: Warnzeichen, eigene Coping-Strategien, soziale Ablenkung, Personen um Hilfe bitten, Fachstellen, Umgebung absichern. Sollte in einer stabilen Phase ausgefüllt werden.
- **Life-Charting (NIMH-Methode) + Social-Rhythm-Tracking** im Tab „Tracking“: täglicher Check-in (Stimmung, Schlaf, Aufstehzeit, Medikation, Reizbarkeit, sozialer Kontakt) als Zeitreihe. Serverseitige, transparente Heuristiken (keine Black-Box-Vorhersage) warnen bei ≥3 Nächten Schlafmangel in Folge oder stark schwankenden Aufstehzeiten.
- **Behavioral Activation** im Tracking-Tab: Mini-Aktivitätenplaner mit Schwierigkeitsstufe (winzig/klein/mittel), Vorschlagsbibliothek nach Kategorie (Bewegung, Selbstfürsorge, sozialer Kontakt, Erledigung) gegen das "mir fällt nichts ein"-Problem, und einer Erfolgs-/Freude-Bewertung nach Erledigung – der eigentliche Kern der Methode: Handeln erzeugt nachweisbar ein Gefühl von Erfolg oder Freude, auch ganz ohne vorherige Motivation.
- **Erweiterter DBT-Notfallkoffer**: zusätzlich zu Kältereiz und 5-4-3-2-1 jetzt auch TIPP (Distress-Toleranz bei extremer Übererregung) und DEAR MAN (zwischenmenschliche Konflikte/Reizbarkeit).
- Die im Profil hinterlegten persönlichen Trigger fließen jetzt aktiv in den Gemini-Coaching-Kontext ein (sofern ein API-Key hinterlegt ist).

## Migration bei bereits laufender Installation

Falls `activity_plans` schon vor der Behavioral-Activation-Erweiterung angelegt wurde, fehlen die neuen Spalten. Einmalig nachziehen:

```sql
ALTER TABLE activity_plans ADD COLUMN difficulty ENUM('tiny','small','medium') NOT NULL DEFAULT 'small' AFTER title;
ALTER TABLE activity_plans ADD COLUMN mastery_rating TINYINT NULL AFTER done;
ALTER TABLE activity_plans ADD COLUMN pleasure_rating TINYINT NULL AFTER mastery_rating;
```

Für die Einwilligung zur Bearbeitung von Gesundheitsdaten (Häkchen bei der Registrierung) zusätzlich:

```sql
ALTER TABLE users ADD COLUMN health_consent_at DATETIME NULL AFTER notes;
```

Bestehende Konten haben danach `NULL` und werden beim nächsten Login um ihre Einwilligung gebeten; bis dahin verweigern die Endpunkte für Gesundheitsdaten den Zugriff.

(Auf einer frisch importierten `schema.sql` nicht nötig – die Spalten sind dort schon in der `CREATE TABLE`-Definition enthalten.)

## Sicherheitsmaßnahmen, die bereits eingebaut sind

- Passwörter mit `password_hash`/`bcrypt`, nie im Klartext gespeichert oder ausgegeben.
- Serverseitige Sessions (httponly, secure, SameSite=Lax Cookies) statt `localStorage`-„Login".
- CSRF-Token-Pflicht für alle verändernden Requests.
- Rate-Limiting & Account-Sperre nach 5 Fehlversuchen (Login, Admin-Login, Registrierung).
- Alle SQL-Zugriffe über Prepared Statements (PDO).
- Konsequentes HTML-Escaping im Frontend (`escapeHtml`) – keine ungefilterten `innerHTML`-Einfügungen mehr.
- Admin-PIN wird gehasht in der DB gespeichert, nicht mehr im Frontend-Code sichtbar.
- Gemini-API-Key verlässt das Backend nie Richtung Client.
- Jeder Nutzer sieht ausschließlich eigene Sitzungen/Nachrichten (serverseitige Ownership-Prüfung).
- Einfache Erkennung von Krisen-/Suizid-Schlüsselwörtern im Chat öffnet automatisch die SOS-Notfallkontakte.

## Bewusst nicht übernommene Funktion

Die alte Version erlaubte dem Admin, sich per Klick als beliebiger Nutzer einzuloggen ("Einloggen"-Button neben jedem Nutzer) – ganz ohne Passwort oder Protokollierung. Das habe ich ersatzlos entfernt, weil es bei sensiblen Gesundheitsdaten ein zu großes Risiko ist (jeder mit der Admin-PIN hätte vollen Zugriff auf jede Nutzer-Identität). Falls eine Support-Impersonation-Funktion gebraucht wird, sollte sie mit Audit-Log und expliziter Nutzer-Zustimmung nachgerüstet werden – sag Bescheid, falls gewünscht.

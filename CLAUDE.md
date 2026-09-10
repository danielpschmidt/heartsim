# Anweisungen für dieses Projekt

## 1. Testing-Verantwortung
Der Nutzer testet Änderungen immer selbst im Browser (visuell, funktional, UX).
Claude muss **nicht** selbst den Browser öffnen, Screenshots machen oder visuell
prüfen, ob etwas gut aussieht oder sich richtig verhält.

Claude ist stattdessen verantwortlich für **Fehlerfreiheit**:
- Syntax-Checks (z. B. `node --check` für eingebettetes JS in `.html`-Dateien)
- Prüfen auf offensichtliche Logikfehler beim Editieren
- Bei Bedarf: kurzer Start eines lokalen Servers nur zum Abgreifen von
  Konsolen-Fehlern (`read_console_messages`), nicht zur visuellen Bewertung

Browser-Automatisierung (Screenshots, Zoom, manuelles Herumklicken zur
Geschmacksprüfung) nur einsetzen, wenn der Nutzer explizit darum bittet.

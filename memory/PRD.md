# Vereinsmitglieder Management App - PRD

## Original Problem Statement
App zur Verwaltung von Vereinsmitgliedern mit Beitragsverfolgung. Öffentliche Liste der gezahlten Beiträge für alle Mitglieder sichtbar. CRUD-Operationen für Mitglieder.

## User Choices
- **Mitgliederdaten**: Nur Vorname und Name
- **Beitragsverfolgung**: Manuelle monatliche Erfassung
- **Öffentliche Liste**: Mitgliedsname + Häkchen für bezahlt
- **Authentifizierung**: Google Login (Emergent Auth)
- **Design**: Hell/Modern

## Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: Emergent Google OAuth

## Core Requirements
1. Mitgliederverwaltung (CRUD)
2. Monatliche Beitragsverfolgung
3. Öffentliche Beitragsübersicht
4. Admin-Authentifizierung via Google

## What's Been Implemented (Jan 2026)
- [x] Google Login Integration (Emergent Auth)
- [x] Mitglieder CRUD (hinzufügen, bearbeiten, löschen)
- [x] Monatliche Beitragsverfolgung (12 Monate pro Jahr)
- [x] Dashboard mit Mitgliedertabelle und Payment-Checkboxen
- [x] Öffentliche Beitragsübersicht (ohne Login)
- [x] Jahr-Auswahl für Beitragsanzeige
- [x] Statistiken (Mitgliederzahl, bezahlt/offen)

## API Endpoints
- `GET /api/public/members/{year}` - Öffentliche Mitgliederliste
- `GET /api/members` - Mitgliederliste (auth)
- `POST /api/members` - Mitglied erstellen (auth)
- `PUT /api/members/{id}` - Mitglied bearbeiten (auth)
- `DELETE /api/members/{id}` - Mitglied löschen (auth)
- `GET /api/payments/year/{year}` - Alle Zahlungen (auth)
- `PUT /api/payments/{member_id}/{year}/{month}` - Zahlung aktualisieren (auth)

## Prioritized Backlog
### P0 (Fertig)
- Mitglieder CRUD
- Beitragsverfolgung
- Öffentliche Ansicht
- Auth

### P1 (Offen)
- Export (CSV/PDF)
- E-Mail Erinnerungen
- Mehrere Admins

### P2 (Nice to Have)
- Zahlungshistorie
- Mitglieder-Suche/Filter
- Mobile App

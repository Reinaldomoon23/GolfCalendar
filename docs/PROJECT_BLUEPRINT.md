# Project Blueprint: Calendario Golf

## 1. Project Overview
**Name:** Golf Tracker / Calendario Golf
**Version:** 2.3.5
**Description:** A React-based web application for tracking golf tournaments, results, and handicaps. Supports both single-player (Nicole) and multi-player (GolfTeam) modes.
**Tech Stack:** React 19, Vite 7, Vanilla CSS (Index.css), PHP Backend API.

## 2. Current Status (As of Jan 2026)
- **Active Theme:** "Modern Zenith Palette" (Light Theme).
    - `Primary`: Charcoal (#333333)
    - `Background`: Warm Light Taupe (#F5F2F0)
    - *Note:* Evidence of a "Midnight" theme attempt exists in conversation history, but current `index.css` reflects the Light theme.
- **Deployment:** 
    - Configured for `single` mode deployment to `/Nicole26`.
    - Script: `deploy.cjs`.
- **Features Implemented:**
    - Calendar View (Tournaments list)
    - Stats View (Charts via matching logic)
    - Handicap View (PDF parsing/display)
    - Profile Photo Upload
    - Offline support (PWA plugin present in package.json)

## 3. Directory Structure
- `src/`: Source code
    - `components/`: React components
    - `data/`: JSON data (tournaments.json)
    - `index.css`: Main styling
- `public/`: Static assets and PHP API files
    - `api/`: Backend logic (upload, save_results, get_handicap)
- `backup_pearl_theme/`: Backup of a previous theme version.

## 4. Pending / Known Issues
- **Theme Discrepancy:** User records suggest a "Midnight" theme was applied, but the codebase shows "Modern Zenith" (Light).
- **Documentation:** `docs/` folder was missing; created this Blueprint to restore context.

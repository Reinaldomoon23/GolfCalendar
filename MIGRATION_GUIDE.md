# Migration Guide - Tournament Filter Simplification & Handicap Fix
**Date:** 2026-01-31  
**Version:** 2.3.5 → 2.3.6

## Overview
This guide documents the changes made to simplify tournament filters and fix the handicap button glitch. Apply these changes to other workspaces (e.g., Nicole's single-user version).

---

## Changes Required

### 1. **CalendarFilters.jsx** - Simplified Filter Groups

**File:** `src/components/CalendarFilters.jsx`

**Replace lines 3-11** (the GROUPS constant):

```javascript
const GROUPS = [
    { id: 'juvenil', label: 'Circuito Juvenil', color: '#db2777' }, // Pink
    { id: 'rfeg', label: 'RFEG', color: '#dc2626' }, // Red
    { id: 'fcg', label: 'FCG', color: '#d97706' }, // Orange
    { id: 'club', label: 'Club', color: '#059669' }, // Green
    { id: 'adultos', label: 'Circuitos Adultos', color: '#4b5563' } // Gray
];
```

---

### 2. **CalendarView.jsx** - Updated Filter Logic

**File:** `src/components/CalendarView.jsx`

**Find the `activeGroups.some(g => {` block** (around line 674-681) and **replace** with:

```javascript
const matchesFilter = activeGroups.some(g => {
    // --- NEW SIMPLIFIED CATEGORIES ---
    if (g === 'juvenil') {
        // Includes Legacy, Baby Cup, Junior Cup, and general underage tournaments
        return (t.groups && (t.groups.includes('legacy') || t.groups.includes('baby_cup'))) ||
            t.type === 'junior_cup' ||
            (t.name && (t.name.toLowerCase().includes('infantil') || t.name.toLowerCase().includes('alevi') || t.name.toLowerCase().includes('benjami')));
    }
    if (g === 'rfeg') {
        return t.organizer === 'RFEG' || (t.groups && t.groups.includes('valedero') && t.organizer !== 'FCG');
    }
    if (g === 'fcg') {
        return t.organizer === 'FCG';
    }
    if (g === 'club') {
        return t.organizer === 'CLUB' || t.organizer === 'CAMIRAL' || t.type === 'club' || (t.groups && t.groups.includes('club'));
    }
    if (g === 'adultos') {
        return (t.groups && t.groups.includes('wagr')) ||
            (t.name && t.name.toLowerCase().includes('absolut')) ||
            (t.organizer !== 'CLUB' && t.organizer !== 'CAMIRAL' && !t.name.toLowerCase().includes('infantil') && !t.name.toLowerCase().includes('alevi'));
    }

    // --- LEGACY FALLBACKS (for old saved preferences) ---
    if (g === 'valedero') return t.valedera;
    if (g === 'grand_prix') return t.grand_prix;
    if (g === 'merit') return (t.merit || t.type === 'merit');
    if (g === 'camiral') return (t.groups && t.groups.includes('camiral'));
    // Default fallback
    return t.groups && t.groups.includes(g);
});
```

**Also update the Type/Format dropdown** (appears twice in CalendarView.jsx):

**Find around line 1200-1212** and **replace** the `<select>` options:
```javascript
<option value="club">Club</option>
<option value="juvenil">Circuito Juvenil</option>
<option value="rfeg">RFEG</option>
<option value="fcg">FCG</option>
<option value="adultos">Circuitos Adultos</option>
```

**Find around line 1330-1342** and **replace** the `<select>` options with the same 5 options above.

---

### 3. **App.jsx** - Handicap Button Fix

**File:** `src/App.jsx`

**Find the handicap button** (around line 567-596) and **replace** the style and text:

```javascript
<button
  className="handicap-btn fade-in"
  onClick={() => pdfUrl && window.open(pdfUrl, '_blank')}
  title={pdfUrl ? "Ver PDF del Hándicap" : "Hándicap actualizado"}
  disabled={!pdfUrl}
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary-dark)',
    padding: '8px 24px',
    borderRadius: '24px',
    marginTop: '12px',
    fontSize: '1.1rem',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    border: '1px solid rgba(0,0,0,0.05)',
    cursor: pdfUrl ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    width: '220px', // Fixed width to prevent jumping
    maxWidth: '90vw',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }}>
  <TrendingUp size={18} className={isUpdatingHandicap ? "spin-animation" : ""} />
  <span>{isUpdatingHandicap ? 'Actualizando...' : (handicap ? `Hándicap: ${String(handicap).substring(0, 15)}` : 'Hándicap: --')}</span>
</button>
```

**Key changes:**
- Changed `minWidth: 'max-content'` to `width: '220px'`
- Added conditional text: `isUpdatingHandicap ? 'Actualizando...' : ...`

**Also update default preferences** (around line 191):

```javascript
groups: ['juvenil', 'rfeg', 'fcg', 'club', 'adultos'],
```

---

### 4. **deploy_multi.cjs** - Include Backend in Deployment (Multi-user only)

**File:** `deploy_multi.cjs`

**Replace entire file** with the version that includes backend deployment:

```javascript
const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const ftpDeploy2 = new FtpDeploy();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("🚀 Starting Multi-User (Team) Deployment...");

// 1. Build for Multi Mode
try {
    console.log("🔨 Building project for mode: VITE_APP_MODE=multi ...");
    execSync('VITE_APP_MODE=multi npm run build', { stdio: 'inherit' });
} catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
}

// 1.5 Fix .htaccess for GolfTeam
try {
    console.log("🔧 Updating .htaccess for /GolfTeam/ base...");
    const htaccessPath = path.join(__dirname, 'dist', '.htaccess');
    if (fs.existsSync(htaccessPath)) {
        let content = fs.readFileSync(htaccessPath, 'utf8');
        content = content.replace(/\/Nicole26\//g, '/GolfTeam/');
        fs.writeFileSync(htaccessPath, content);
        console.log("✅ .htaccess updated.");
    } else {
        console.warn("⚠️ .htaccess not found in dist!");
    }
} catch (err) {
    console.error("❌ Failed to update .htaccess:", err);
}

// 2. Configure FTP for Frontend (dist)
const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: __dirname + "/dist",
    remoteRoot: "/public_html/GolfTeam/",
    include: ["*", "**/*", ".htaccess"],
    exclude: [
        "dist/**/*.map",
        ".git/**"
    ],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

// 2.5 Configure FTP for Backend (public/api and public/data)
const backendConfig = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: __dirname + "/public",
    remoteRoot: "/public_html/GolfTeam/",
    include: ["api/**/*", "data/**/*", "profiles/**/*"],
    exclude: [
        "api/users.json",           // Protect User Database
        "data/custom_tournaments_*.json", // Protect User Custom Tournaments
        "data/prefs_*.json",        // Protect User Preferences
        "data/results_*.json",      // Protect User Results
        "data/handicap_history_*.json" // Protect Handicap History
    ],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

// 3. Deploy Frontend
console.log("📤 Deploying frontend to " + config.remoteRoot + "...");

ftpDeploy
    .deploy(config)
    .then(res => {
        console.log("✅ Frontend deployment finished!");
        console.log("📤 Deploying backend (PHP) to " + backendConfig.remoteRoot + "...");
        return ftpDeploy2.deploy(backendConfig);
    })
    .then(res => console.log("✅ Backend deployment finished! All done!"))
    .catch(err => console.log("❌ Deployment failed:", err));
```

---

## Testing Checklist

After applying changes:

- [ ] Verify 5 filter buttons appear: Circuito Juvenil, RFEG, FCG, Club, Circuitos Adultos
- [ ] Test filtering tournaments with each category
- [ ] Check handicap button shows "Actualizando..." when loading
- [ ] Verify handicap button doesn't jump/glitch when updating
- [ ] Test deployment includes both frontend and backend files

---

## Files Modified

1. `src/components/CalendarFilters.jsx`
2. `src/components/CalendarView.jsx`
3. `src/App.jsx`
4. `deploy_multi.cjs` (multi-user version only)

---

## Notes

- Old filter preferences will still work due to legacy fallback logic
- Backend deployment is only needed for multi-user workspace
- Single-user version (Nicole) can skip the deploy_multi.cjs changes

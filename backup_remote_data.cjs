const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BACKUP_DIR = path.join(__dirname, 'server_backups');
const BASE_URL = 'https://reinaldomoon.top/GolfTeam/';

// Files to backup with their relative paths from BASE_URL
const FILES_TO_BACKUP = [
    'api/users.json',
    'data/results_nicole.json',
    'data/custom_tournaments_nicole.json',
    'data/handicap_history_nicole.json',
    'data/prefs_nicole.json',
    'data/results_maria.json',
    'data/custom_tournaments_maria.json',
    'data/prefs_maria.json',
    'data/results_txell.json',
    'data/prefs_txell.json',
    'data/custom_tournaments_txell.json',
    'data/results_ona.json',
    'data/prefs_ona.json',
    'data/custom_tournaments_ona.json',
    'data/results_valentina.json',
    'data/prefs_valentina.json',
    'data/custom_tournaments_valentina.json'
];

async function backupRemoteData() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR);
    }

    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const sessionDir = path.join(BACKUP_DIR, `backup_${timestamp}`);
    fs.mkdirSync(sessionDir);
    // Create folders structure if needed
    if (!fs.existsSync(path.join(sessionDir, 'data'))) fs.mkdirSync(path.join(sessionDir, 'data'));
    if (!fs.existsSync(path.join(sessionDir, 'api'))) fs.mkdirSync(path.join(sessionDir, 'api'));

    console.log(`🛡️  Starting Safety Backup to: ${sessionDir}`);

    let successCount = 0;

    for (const file of FILES_TO_BACKUP) {
        const url = `${BASE_URL}${file}`;
        try {
            const response = await axios.get(url, { responseType: 'text' }); // Get text/json
            if (response.status === 200) {
                // Determine if it's the HTML 404 page or real JSON
                if (typeof response.data === 'string' && response.data.trim().startsWith('<!doctype html>')) {
                    // console.log(`   (Skip) ${file} not found (returned HTML).`);
                } else {
                    const dest = path.join(sessionDir, file);
                    const content = typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data;
                    fs.writeFileSync(dest, content);
                    console.log(`   ✅ Saved: ${file}`);
                    successCount++;
                }
            }
        } catch (err) {
            // console.log(`   (Skip) ${file}: ${err.message}`);
        }
    }

    if (successCount === 0) {
        console.warn("⚠️  Warning: No user data files were found to backup. This might be normal if the server is clean, or a sign of connection issues.");
    } else {
        console.log(`🎉 Backup completed: ${successCount} files saved.`);
    }
}

if (require.main === module) {
    backupRemoteData();
}

module.exports = backupRemoteData;

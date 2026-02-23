import fs from 'fs';
import path from 'path';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";

// Firebase Config (Must match src/firebase.js)
const firebaseConfig = {
    apiKey: "AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0",
    authDomain: "golfscorings-e4338.firebaseapp.com",
    projectId: "golfscorings-e4338",
    storageBucket: "golfscorings-e4338.firebasestorage.app",
    messagingSenderId: "987034024177",
    appId: "1:987034024177:web:560e69822800f3a613d150"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Paths to your data files
// We will look for data in the 'server_backups' folder from the latest backup
// OR directly from the current project structure if available.
// Let's use the local files in 'public/data/' or 'src/data/' as source of truth?
// Actually, the server backup we recovered earlier had the good data.
// Let's use the LATEST server backup found in 'server_backups/'

// Helper to find latest backup folder
const getLatestBackupDir = () => {
    const backupDir = path.resolve('server_backups');
    if (!fs.existsSync(backupDir)) return null;

    const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup_'))
        .sort()
        .reverse(); // Newest first

    return backups.length > 0 ? path.join(backupDir, backups[0], 'data') : null;
};

const dataDir = getLatestBackupDir();
if (!dataDir) {
    console.error("No backup found in server_backups/. Cannot migrate.");
    process.exit(1);
}

console.log(`Using data from: ${dataDir}`);

// 1. Migrate Users
const migrateUsers = async () => {
    const usersFile = path.join(dataDir, 'users.json');
    if (fs.existsSync(usersFile)) {
        const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        console.log(`Migrating ${users.length} users...`);
        for (const user of users) {
            // Use username as ID for simplicity or auto-id
            await setDoc(doc(db, "users", user.username), user);
            console.log(`  User ${user.username} migrated.`);
        }
    }
};

// 2. Migrate Tournaments (Global)
const migrateTournaments = async () => {
    // Note: tournaments.json is usually in src/data/tournaments.json in local dev, 
    // but in backup it might be just tournaments.json
    const tourneysFile = path.join(dataDir, 'tournaments.json');

    // Also check possible local location if backup is missing it
    const localTourneysFile = path.resolve('src/data/tournaments.json');

    let tournaments = [];
    if (fs.existsSync(tourneysFile)) {
        tournaments = JSON.parse(fs.readFileSync(tourneysFile, 'utf8'));
    } else if (fs.existsSync(localTourneysFile)) {
        console.log("Using local src/data/tournaments.json");
        tournaments = JSON.parse(fs.readFileSync(localTourneysFile, 'utf8'));
    }

    if (tournaments.length) {
        console.log(`Migrating ${tournaments.length} global tournaments...`);
        // We store them in a single document "global" in "tournaments_data" collection OR separate docs?
        // Separate docs in "tournaments" collection is better for querying
        for (const t of tournaments) {
            await setDoc(doc(db, "tournaments", String(t.id)), t);
        }
        console.log("  Global tournaments migrated.");
    }
};


// 3. Migrate User Specific Data (Results & Custom Tournaments)
const migrateUserFiles = async () => {
    const files = fs.readdirSync(dataDir);

    // Process results_*.json
    const resultFiles = files.filter(f => f.startsWith('results_') && f.endsWith('.json'));
    for (const file of resultFiles) {
        const username = file.replace('results_', '').replace('.json', '');
        const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));

        console.log(`Migrating results for ${username}...`);
        // We'll store results in a subcollection: users/{username}/results/{tournamentId}
        // OR a top level collection "results" with userId field?
        // Subcollection is cleaner for privacy rules later.

        for (const [tournamentId, result] of Object.entries(content)) {
            // Ensure ID is string
            await setDoc(doc(db, "users", username, "results", String(tournamentId)), result);
        }
    }

    // Process custom_tournaments_*.json
    const customFiles = files.filter(f => f.startsWith('custom_tournaments_') && f.endsWith('.json'));
    for (const file of customFiles) {
        const username = file.replace('custom_tournaments_', '').replace('.json', '');
        const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));

        console.log(`Migrating custom tournaments for ${username}...`);
        for (const t of content) {
            // Ensure it has custom flag
            const tournament = { ...t, custom: true, owner: username };
            await setDoc(doc(db, "users", username, "custom_tournaments", String(t.id)), tournament);
        }
    }

    // Process prefs_*.json
    const prefsFiles = files.filter(f => f.startsWith('prefs_') && f.endsWith('.json'));
    for (const file of prefsFiles) {
        const username = file.replace('prefs_', '').replace('.json', '');
        const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));

        console.log(`Migrating preferences for ${username}...`);
        await setDoc(doc(db, "users", username, "settings", "preferences"), content);
    }
};

const run = async () => {
    try {
        await migrateUsers();
        await migrateTournaments();
        await migrateUserFiles();
        console.log("✅ Migration Complete!");
        process.exit(0);
    } catch (error) {
        console.error("Migration Failed:", error);
        process.exit(1);
    }
};

run();

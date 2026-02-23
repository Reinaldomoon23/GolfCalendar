const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const ftpDeploy2 = new FtpDeploy();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const backupRemoteData = require('./backup_remote_data.cjs');

console.log("🚀 Starting Multi-User (Team) Deployment...");

(async () => {
    // 0. Perform Pre-Flight Backup
    try {
        await backupRemoteData();
    } catch (err) {
        console.error("❌ Backup failed:", err);
        console.log("⚠️  Continuing deployment (risky) or exiting? decided to continue but check logs.");
        // We continue because backup failure shouldn't block critical fix deployment, but user is warned.
    }

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
            ".git/**",
            "profile.jpg", // PROTECT EXISTING SERVER AVATAR
            "**/handicap_history.json",
            "**/results.json",
            "tournaments.json", // DO NOT OVERWRITE SERVER TOURNAMENTS
            "**/prefs_*.json" // DO NOT OVERWRITE USER PREFS
        ],
        deleteRemote: false,
        forcePasv: true,
        sftp: false
    };

    // 2.5 Configure FTP for Backend (ONLY PHP API FILES - NO USER DATA)
    const backendConfig = {
        user: "jordi@reinaldomoon.top",
        password: "DanzigXtothec23$",
        host: "ftp.reinaldomoon.top",
        port: 21,
        localRoot: __dirname + "/public/api",  // ONLY API FOLDER
        remoteRoot: "/public_html/GolfTeam/api/",  // ONLY API DESTINATION
        include: [
            "*.php"  // ONLY PHP FILES
        ],
        exclude: [
            "**/*.json",  // NO JSON FILES AT ALL
            "**/*.log",
            ".DS_Store",
            "users.json",
            "results_*.json",
            "custom_tournaments_*.json",
            "prefs_*.json",
            "handicap_history_*.json"
        ],
        // SAFETY LOCK: Explicitly block ANY json file
        filter: function (file) {
            if (file.endsWith('.json')) {
                console.log(`🔒 BLOCKING JSON FILE: ${file}`);
                return false;
            }
            return true;
        },
        deleteRemote: false,
        forcePasv: true,
        sftp: false
    };

    // 3. Deploy Frontend & Backend
    console.log("📤 Deploying frontend to " + config.remoteRoot + "...");

    try {
        await ftpDeploy.deploy(config);
        console.log("✅ Frontend deployment finished!");

        console.log("📤 Deploying backend (PHP) to " + backendConfig.remoteRoot + "...");
        await ftpDeploy2.deploy(backendConfig);
        console.log("✅ Backend deployment finished! All done!");
    } catch (err) {
        console.log("❌ Deployment failed:", err);
    }

})();

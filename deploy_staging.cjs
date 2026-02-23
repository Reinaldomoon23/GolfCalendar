const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const ftpDeploy2 = new FtpDeploy();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const backupRemoteData = require('./backup_remote_data.cjs');

console.log("🚀 Starting Staging Deployment (GolfTeam_Staging)...");

(async () => {
    // 0. Perform Pre-Flight Backup (Optional for staging but good practice if overwriting existing staging data)
    // We can skip backup for staging if it's considered disposable, but let's be safe.
    try {
        // Only backup if we want to preserve staging data. Let's skip for now to speed up.
        // await backupRemoteData(); 
    } catch (err) {
        console.error("❌ Backup failed:", err);
    }

    // 1. Build for Staging Mode
    try {
        console.log("🔨 Building project for mode: VITE_APP_MODE=multi VITE_BASE_URL=/GolfTeam_Staging/ ...");
        // We set VITE_BASE_URL to override the base path in vite.config.js
        execSync('VITE_APP_MODE=multi VITE_BASE_URL=/GolfTeam_Staging/ npm run build', { stdio: 'inherit' });
    } catch (err) {
        console.error("❌ Build failed:", err);
        process.exit(1);
    }

    // 1.5 Fix .htaccess for GolfTeam_Staging base
    try {
        console.log("🔧 Updating .htaccess for /GolfTeam_Staging/ base...");
        const htaccessPath = path.join(__dirname, 'dist', '.htaccess');
        if (fs.existsSync(htaccessPath)) {
            let content = fs.readFileSync(htaccessPath, 'utf8');
            // Check if we start with the original source base '/Nicole26/'
            content = content.replace(/\/Nicole26\//g, '/GolfTeam_Staging/');
            // Just in case build output already modified it (unlikely if source is unchanged), 
            // but also handle if source was '/GolfTeam/' in some unexpected way. 
            // The source .htaccess has /Nicole26/ hardcoded.

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
        remoteRoot: "/public_html/GolfTeam_Staging/",
        include: ["*", "**/*", ".htaccess"],
        exclude: [
            "dist/**/*.map",
            ".git/**",
            "profile.jpg", // We might want to overwrite this in staging? Let's keep data consistent with prod logic.
            "**/handicap_history.json",
            "**/results.json"
        ],
        deleteRemote: false, // Safer to not delete remote for now
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
        remoteRoot: "/public_html/GolfTeam_Staging/",
        include: [
            "api/*.php"
        ],
        exclude: [
            "dist/**/*.map",
            ".git/**",
            "profile.jpg",
            "**/handicap_history.json",
            "**/results.json",
            "api/users.json",
            "data/results_*.json",
            "data/custom_tournaments_*.json",
            "data/prefs_*.json",
            "data/handicap_history_*.json",
            "profiles/*",
            "api/results_*.json",
            "**/*.log",
            ".DS_Store"
        ],
        filter: function (file) {
            const forbidden = /results_.*\.json|custom_tournaments_.*\.json|prefs_.*\.json|users\.json|handicap_history_.*\.json|profiles\//;
            if (forbidden.test(file)) {
                console.log(`🔒 SKIPPING PROTECTED FILE: ${file}`);
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
        console.log("\n🌐 Preview URL: https://reinaldomoon.top/GolfTeam_Staging/");
    } catch (err) {
        console.log("❌ Deployment failed:", err);
    }

})();

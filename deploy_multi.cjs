const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const ftpDeploy2 = new FtpDeploy();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("🚀 Starting Multi-User (Team) Deployment...");

// 1. Build for Multi Mode
// We must build first because the base URL and logic changes
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

const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
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

// 2. Configure FTP
const config = {
    user: "jordi@reinaldomoon.top", // Same FTP user
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: __dirname + "/dist",
    remoteRoot: "/public_html/GolfTeam/", // <--- DIFFERENT FOLDER
    include: ["*", "**/*", ".htaccess"],
    exclude: [
        "dist/**/*.map",
        ".git/**",
        "api/users.json",           // Protect User Database
        "data/custom_tournaments_*.json", // Protect User Custom Tournaments
        "data/prefs_*.json",        // Protect User Preferences
        "data/results_*.json"       // Protect User Results
    ],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

// 3. Deploy
console.log("📤 deploying to " + config.remoteRoot + "...");

ftpDeploy
    .deploy(config)
    .then(res => console.log("✅ Deployment to /GolfTeam finished successfully!"))
    .catch(err => console.log("❌ Deployment failed:", err));

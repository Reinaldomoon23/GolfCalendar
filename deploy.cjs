const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("🚀 Starting Single User (Nicole) Deployment...");

// 0. Build for Single Mode
try {
    console.log("🔨 Building project for mode: VITE_APP_MODE=single ...");
    execSync('VITE_APP_MODE=single npm run build', { stdio: 'inherit' });
} catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
}

// Backup Logic
function performBackup() {
    const backupBaseDir = path.join(__dirname, 'build_backups');
    const distDir = path.join(__dirname, 'dist');
    // ... logic continues ...
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupBaseDir)) {
        fs.mkdirSync(backupBaseDir);
    }
    //...
    // ...
    // ...
    // Generate Timestamp: YYYY-MM-DD_HH-mm-ss
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];

    // Read version from package.json
    const packageJson = require('./package.json');
    const version = packageJson.version || '0.0.0';

    const versionDir = path.join(backupBaseDir, `build_v${version}_${timestamp}_single`); // Added version prefix
    try {
        if (fs.existsSync(distDir)) {
            // recursive copy
            execSync(`cp -r "${distDir}" "${versionDir}"`);
        } else {
            console.error("Dist folder not found, skipping backup.");
            return;
        }
    } catch (err) {
        console.error("Error creating backup:", err);
        return;
    }

    // Rotation Logic: Keep last 5
    try {
        const backups = fs.readdirSync(backupBaseDir)
            .filter(file => file.startsWith('build_') && fs.statSync(path.join(backupBaseDir, file)).isDirectory())
            .sort().reverse(); // Newest first

        if (backups.length > 5) {
            const toDelete = backups.slice(5);
            toDelete.forEach(dir => {
                const fullPath = path.join(backupBaseDir, dir);
                console.log(`Deleting old backup: ${fullPath}`);
                fs.rmSync(fullPath, { recursive: true, force: true });
            });
        }
    } catch (err) {
        console.error("Error rotating backups:", err);
    }
}

performBackup();

const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: __dirname + "/dist", // Vite builds to /dist by default
    remoteRoot: "/public_html/Nicole26/",
    include: ["*", "**/*", ".htaccess"],
    exclude: ["dist/**/*.map", ".git/**", "results.json"],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

console.log("Starting deployment to " + config.remoteRoot + "...");

ftpDeploy
    .deploy(config)
    .then(res => console.log("Deployment finished successfully!"))
    .catch(err => console.log("Deployment failed:", err));

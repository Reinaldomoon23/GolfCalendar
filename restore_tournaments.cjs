const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const fs = require('fs');
const path = require('path');

console.log("🚀 Starting Tournaments Restoration...");

(async () => {
    // 1. Create temporary directory
    const tempDir = path.join(__dirname, 'temp_tournaments_restore');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    // 2. Copy tournaments.json to temp dir
    const srcPath = path.join(__dirname, 'src', 'data', 'tournaments.json');
    const destPath = path.join(tempDir, 'tournaments.json');

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log("✅ Copied src/data/tournaments.json to temp folder.");
    } else {
        console.error("❌ Source tournaments.json not found!");
        process.exit(1);
    }

    // 3. Deploy ONLY tournaments.json
    const config = {
        user: "jordi@reinaldomoon.top",
        password: "DanzigXtothec23$",
        host: "ftp.reinaldomoon.top",
        port: 21,
        localRoot: tempDir,
        remoteRoot: "/public_html/GolfTeam/",
        include: ["tournaments.json"], // Only upload this file
        deleteRemote: false,
        forcePasv: true,
        sftp: false
    };

    console.log("📤 Uploading tournaments.json to " + config.remoteRoot + "...");

    try {
        await ftpDeploy.deploy(config);
        console.log("✅ Tournaments restoration finished!");
    } catch (err) {
        console.log("❌ Restoration failed:", err);
    } finally {
        // Cleanup temp folder
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
        console.log("🧹 Cleanup done.");
    }

})();

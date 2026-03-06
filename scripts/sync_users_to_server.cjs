const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require('path');

const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: path.join(__dirname, '..', 'public', 'api'),
    remoteRoot: "/public_html/GolfTeam/api/",
    include: ["users.json"],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

console.log("📤 Restoring users.json to server with correct licenses...");

ftpDeploy.deploy(config)
    .then(res => console.log("✅ users.json restored successfully!"))
    .catch(err => console.log("❌ Sync failed:", err));

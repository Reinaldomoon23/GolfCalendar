const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require('path');

const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: __dirname + "/public/data",
    remoteRoot: "/public_html/GolfTeam/data/",
    include: [
        "custom_tournaments_maria.json",
        "prefs_maria.json",
        "custom_tournaments_nicole.json",
        "prefs_nicole.json"
    ],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

console.log("📤 Uploading Maria's data (Clone of Nicole)...");

ftpDeploy.deploy(config)
    .then(res => console.log("✅ Maria's data uploaded successfully!"))
    .catch(err => console.log("❌ Upload failed:", err));

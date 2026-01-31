const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require('path');

const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: path.join(__dirname, "dist"),
    remoteRoot: "/public_html/Nicole26/",
    include: ["*", "**/*", ".htaccess"],
    exclude: ["dist/**/*.map", ".git/**", "results.json"],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

console.log("🚀 Starting Rollback Deployment to " + config.remoteRoot + "...");

ftpDeploy
    .deploy(config)
    .then(res => console.log("✅ Rollback finished successfully!"))
    .catch(err => console.log("❌ Rollback failed:", err));

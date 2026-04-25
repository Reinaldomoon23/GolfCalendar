const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require('path');

const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: __dirname + "/dist",
    remoteRoot: "/public_html/",
    include: ["*", "**/*", ".htaccess"],
    exclude: [
        "dist/**/*.map",
        ".git/**",
        "**/handicap_history.json",
        "**/results.json"
    ],
    deleteRemote: false,
    forcePasv: true,
    sftp: false
};

(async () => {
    try {
        console.log("📤 Deploying frontend to " + config.remoteRoot + "...");
        await ftpDeploy.deploy(config);
        console.log("✅ Frontend deployment finished!");
    } catch (err) {
        console.log("❌ Deployment failed:", err);
    }
})();

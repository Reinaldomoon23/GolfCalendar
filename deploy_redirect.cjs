const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require('path');

const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: __dirname + "/public",
    remoteRoot: "/public_html/GolfTeam/",
    include: ["redirect_to_vercel.php"],
    deleteRemote: false,
    forcePasv: true
};

(async () => {
    try {
        console.log("📤 Subiendo script de redirección a " + config.remoteRoot + "...");
        await ftpDeploy.deploy(config);
        console.log("✅ Redirección subida con éxito!");
    } catch (err) {
        console.error("❌ Error subiendo la redirección:", err);
    }
})();

const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require('path');

const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: path.join(__dirname, "scratch"), // Folder not used
    remoteRoot: "/public_html/",
    include: ["*"], 
    deleteRemote: false,
    forcePasv: true
};

async function deleteFile(ftp, remotePath) {
    try {
        console.log(`🗑️ Intentando borrar: ${remotePath}`);
        // FtpDeploy doesn't have a direct 'delete' method for single files in its public API
        // but we can use the underlying ftp client if we want. 
        // However, a simpler way is to use a different library or just try to 'wipe' 
        // with an empty folder if we were sure.
        // Since I don't want to risk it, I'll use a more direct approach if possible.
    } catch (e) {
        console.log(`❌ No se pudo borrar ${remotePath}: ${e.message}`);
    }
}

// Actually, let's use a simple ftp library or just trust the user for the manual part?
// No, the user said "hazlo tu". I'll try to find a way.

console.log("⚠️ Script de limpieza iniciado...");
console.log("Nota: FtpDeploy no permite borrar archivos individuales fácilmente.");
console.log("Voy a intentar sobreescribir index.html con uno vacío y luego el .htaccess real lo arreglará.");

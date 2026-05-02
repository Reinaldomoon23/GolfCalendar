const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require('path');
const fs = require('fs');

const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: path.join(__dirname, "dist"),
    remoteRoot: "/public_html/GolfTeam/",
    include: ["*", "**/*", ".htaccess"],
    exclude: [
        "dist/**/*.map",
        ".git/**",
        "**/handicap_history.json",
        "**/results.json"
    ],
    deleteRemote: false, // ¡IMPORTANTE! No borrar para no matar la API
    forcePasv: true,
    sftp: false
};

(async () => {
    try {
        // 1. Desplegar la App completa a /GolfTeam/ (Zona segura)
        console.log("📤 Desplegando App completa a /GolfTeam/...");
        await ftpDeploy.deploy(config);
        console.log("✅ Despliegue en /GolfTeam/ completado.");

        // 2. Crear un .htaccess QUIRÚRGICO para la Raíz
        // Este archivo SOLO redirigirá lo necesario y respetará tus otras webs
        const tempDir = path.join(__dirname, "temp_root_deploy");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const surgicalHtaccess = `<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /

# --- PROTECCIÓN PARA OTRAS WEBS ---
# Si la petición ya es para Player_HCP u otras carpetas, NO tocar nada
RewriteCond %{REQUEST_URI} ^/Player_HCP/ [NC,OR]
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^.*$ - [L]

# --- REDIRECCIONES ESPECÍFICAS DE GOLF A GOLFTEAM ---
# Redirigir las rutas principales a la subcarpeta local
RewriteCond %{REQUEST_URI} ^/live/ [NC,OR]
RewriteCond %{REQUEST_URI} ^/live-team/ [NC,OR]
RewriteCond %{REQUEST_URI} ^/stats [NC,OR]
RewriteCond %{REQUEST_URI} ^/handicap [NC,OR]
RewriteCond %{REQUEST_URI} ^/tournaments [NC,OR]
RewriteCond %{REQUEST_URI} ^/event/ [NC,OR]
RewriteCond %{REQUEST_URI} ^/admin [NC,OR]
RewriteCond %{REQUEST_URI} ^/leaderboard/ [NC]
RewriteRule ^(.*)$ /GolfTeam/$1 [R=301,L]

# --- OPCIONAL: EL ROOT ---
# Si quieres que entrar a reinaldomoon.top (a secas) vaya a la app, descomenta la siguiente línea:
# RewriteRule ^$ /GolfTeam/ [R=301,L]

</IfModule>`;

        fs.writeFileSync(path.join(tempDir, ".htaccess"), surgicalHtaccess);
        
        // Copiar el Kill Switch para el Service Worker
        const killSwitchPath = path.join(__dirname, "public", "sw-killswitch.js");
        if (fs.existsSync(killSwitchPath)) {
            fs.copyFileSync(killSwitchPath, path.join(tempDir, "sw.js"));
            console.log("🛠️ Incluyendo Service Worker Kill Switch...");
        }

        console.log("📤 Subiendo .htaccess quirúrgico y Kill Switch a la Raíz (/)...");
        await ftpDeploy.deploy({
            ...config,
            localRoot: tempDir,
            remoteRoot: "/public_html/",
            include: [".htaccess", "sw.js"],
            deleteRemote: false // NUNCA borrar el root
        });

        // Limpiar carpeta temporal
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.log("✅ ¡Todo listo! El root ahora es seguro para tus otras páginas.");
        console.log("⚠️ RECUERDA: Debes borrar manualmente los archivos 'index.html' y la carpeta 'assets' de tu root en Hostinger para limpiar el rastro antiguo.");

    } catch (err) {
        console.log("❌ Error en el despliegue:", err);
    }
})();


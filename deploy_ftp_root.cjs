const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const path = require('path');
const fs = require('fs');

const ftpUser = process.env.ROUNDTRACKER_FTP_USER;
const ftpPassword = process.env.ROUNDTRACKER_FTP_PASSWORD;
const ftpHost = process.env.ROUNDTRACKER_FTP_HOST || 'ftp.reinaldomoon.top';

if (!ftpUser || !ftpPassword) {
    throw new Error('Faltan ROUNDTRACKER_FTP_USER o ROUNDTRACKER_FTP_PASSWORD en el entorno.');
}

const config = {
    user: ftpUser,
    password: ftpPassword,
    host: ftpHost,
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

        // Protect legacy API data files while keeping PHP endpoints executable.
        const apiSecurityRoot = path.join(__dirname, "public", "api");
        const apiSecurityFile = path.join(apiSecurityRoot, ".htaccess");
        if (fs.existsSync(apiSecurityFile)) {
            await ftpDeploy.deploy({
                ...config,
                localRoot: apiSecurityRoot,
                remoteRoot: "/public_html/GolfTeam/api/",
                include: [".htaccess"],
                deleteRemote: false
            });
            console.log("✅ Datos internos de la API protegidos mediante .htaccess.");
        }

        const dataSecurityRoot = path.join(__dirname, "public", "data");
        const dataSecurityFile = path.join(dataSecurityRoot, ".htaccess");
        if (fs.existsSync(dataSecurityFile)) {
            await ftpDeploy.deploy({
                ...config,
                localRoot: dataSecurityRoot,
                remoteRoot: "/public_html/GolfTeam/data/",
                include: [".htaccess"],
                deleteRemote: false
            });
            console.log("✅ Carpeta de datos legacy protegida mediante .htaccess.");
        }

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
        const killSwitchPath = path.join(__dirname, "public-app", "sw-killswitch.js");
        if (fs.existsSync(killSwitchPath)) {
            fs.copyFileSync(killSwitchPath, path.join(tempDir, "sw.js"));
            console.log("🛠️ Incluyendo Service Worker Kill Switch...");
        }

        // Keep notification icons available at the domain root for users with
        // an older cached bundle that still requests /pwa-192x192.png.
        for (const iconName of ["pwa-192x192.png", "pwa-512x512.png"]) {
            const iconPath = path.join(__dirname, "public-app", iconName);
            if (fs.existsSync(iconPath)) {
                fs.copyFileSync(iconPath, path.join(tempDir, iconName));
            }
        }

        console.log("📤 Subiendo .htaccess quirúrgico y Kill Switch a la Raíz (/)...");
        await ftpDeploy.deploy({
            ...config,
            localRoot: tempDir,
            remoteRoot: "/public_html/",
            include: [".htaccess", "sw.js", "pwa-192x192.png", "pwa-512x512.png"],
            deleteRemote: false // NUNCA borrar el root
        });

        // Replace the old app-scoped worker too. Otherwise a cached worker
        // under /GolfTeam/ can keep serving the old login bundle and block
        // keyboard input even after the new files were uploaded.
        await ftpDeploy.deploy({
            ...config,
            localRoot: tempDir,
            remoteRoot: "/public_html/GolfTeam/",
            include: ["sw.js"],
            deleteRemote: false
        });
        console.log("✅ Service Worker antiguo de /GolfTeam/ desactivado.");

        // Limpiar carpeta temporal
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.log("✅ ¡Todo listo! El root ahora es seguro para tus otras páginas.");
        console.log("⚠️ RECUERDA: Debes borrar manualmente los archivos 'index.html' y la carpeta 'assets' de tu root en Hostinger para limpiar el rastro antiguo.");

    } catch (err) {
        console.log("❌ Error en el despliegue:", err);
    }
})();

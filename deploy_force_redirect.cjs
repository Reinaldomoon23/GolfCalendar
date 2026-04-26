const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const fs = require('fs');
const path = require('path');

const config = {
    user: "jordi@reinaldomoon.top",
    password: "DanzigXtothec23$",
    host: "ftp.reinaldomoon.top",
    port: 21,
    localRoot: __dirname + "/diverted_dist",
    remoteRoot: "/public_html/GolfTeam/",
    include: [".htaccess", "index.php"],
    deleteRemote: false, // Don't wipe the API folder!
    forcePasv: true
};

(async () => {
    try {
        fs.mkdirSync('diverted_dist', { recursive: true });
        
        // Write the super .htaccess for subfolder
        const htaccessSubfolder = `<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /GolfTeam/
RewriteCond %{REQUEST_URI} ^/GolfTeam/api [NC]
RewriteRule ^.*$ - [L]
RewriteCond %{REQUEST_URI} !^/GolfTeam/api [NC]
RewriteRule ^(.*)$ https://golf-calendar-v3.vercel.app/$1 [R=301,L]
</IfModule>`;
        
        // Write the super .htaccess for root
        const htaccessRoot = `<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_URI} ^/api [NC]
RewriteRule ^.*$ - [L]
RewriteCond %{REQUEST_URI} !^/api [NC]
RewriteRule ^(.*)$ https://golf-calendar-v3.vercel.app/$1 [R=301,L]
</IfModule>`;

        const indexContent = `<?php
header("HTTP/1.1 301 Moved Permanently");
header("Location: https://golf-calendar-v3.vercel.app/");
exit;
?>`;

        // Deploy to /GolfTeam/
        fs.writeFileSync(path.join(__dirname, 'diverted_dist', '.htaccess'), htaccessSubfolder);
        fs.writeFileSync(path.join(__dirname, 'diverted_dist', 'index.php'), indexContent);
        console.log("📤 Configurando redireccion en /GolfTeam/...");
        await ftpDeploy.deploy({
            ...config,
            remoteRoot: "/public_html/GolfTeam/",
            deleteRemote: true,
            exclude: ["api/**", "profiles/**", "*.json", "*.php"] // Preserve data and API
        });

        // Deploy to root
        fs.writeFileSync(path.join(__dirname, 'diverted_dist', '.htaccess'), htaccessRoot);
        console.log("📤 Configurando redireccion en el ROOT...");
        await ftpDeploy.deploy({
            ...config,
            remoteRoot: "/public_html/",
            deleteRemote: true,
            exclude: ["GolfTeam/**", "api/**", "profiles/**", "*.json", "phpinfo.php", "test_*.php"] // Don't wipe the subfolder we just updated!
        });

        console.log("✅ Redirección masiva y limpieza completada.");

    } catch (err) {
        console.error("❌ Error en la limpieza/redirección:", err);
    }
})();

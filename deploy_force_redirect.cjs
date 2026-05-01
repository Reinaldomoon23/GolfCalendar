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
RewriteBase /Player_HCP/
RewriteCond %{REQUEST_URI} ^/Player_HCP/api [NC]
RewriteRule ^.*$ - [L]
RewriteCond %{REQUEST_URI} !^/Player_HCP/api [NC]
RewriteRule ^(.*)$ /Player_HCP/index.html [L]
</IfModule>`;
        
        // Write the super .htaccess for root - SURGICAL VERSION
        const htaccessRoot = `<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /

# 1. No redirigir si el archivo o carpeta existe (Protege otras webs)
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^.*$ - [L]

# 2. Preservar la API
RewriteCond %{REQUEST_URI} ^/api [NC,OR]
RewriteCond %{REQUEST_URI} ^/Player_HCP/api [NC]
RewriteRule ^.*$ - [L]

# 3. Redirigir SOLO rutas de Golf a Player_HCP
RewriteCond %{REQUEST_URI} ^/live/ [NC,OR]
RewriteCond %{REQUEST_URI} ^/live-team/ [NC,OR]
RewriteCond %{REQUEST_URI} ^/stats [NC,OR]
RewriteCond %{REQUEST_URI} ^/handicap [NC,OR]
RewriteCond %{REQUEST_URI} ^/tournaments [NC,OR]
RewriteCond %{REQUEST_URI} ^/event/ [NC,OR]
RewriteCond %{REQUEST_URI} ^/admin [NC]
RewriteRule ^(.*)$ /Player_HCP/$1 [R=301,L]
</IfModule>`;

        const indexContent = `<?php
header("HTTP/1.1 301 Moved Permanently");
header("Location: https://golf-calendar-v3.vercel.app/");
exit;
?>`;

        // Deploy to /Player_HCP/
        fs.writeFileSync(path.join(__dirname, 'diverted_dist', '.htaccess'), htaccessSubfolder);
        fs.writeFileSync(path.join(__dirname, 'diverted_dist', 'index.php'), indexContent);
        console.log("📤 Configurando redireccion en /Player_HCP/...");
        await ftpDeploy.deploy({
            ...config,
            remoteRoot: "/public_html/Player_HCP/",
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
            exclude: ["Player_HCP/**", "api/**", "profiles/**", "*.json", "phpinfo.php", "test_*.php"] // Don't wipe the subfolder we just updated!
        });

        console.log("✅ Redirección masiva y limpieza completada.");

    } catch (err) {
        console.error("❌ Error en la limpieza/redirección:", err);
    }
})();

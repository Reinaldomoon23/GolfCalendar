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
        
        // Write the super .htaccess
        const htaccessContent = `<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /GolfTeam/

# Evita redirigir la API (para que get_handicap.php siga funcionando para Vercel)
# Si la ruta contiene /api/, no hagas nada [L]
RewriteCond %{REQUEST_URI} ^/GolfTeam/api [NC]
RewriteRule ^.*$ - [L]

# Redirige todo el resto del tráfico web hacia la app de la producción en Vercel
RewriteCond %{REQUEST_URI} !^/GolfTeam/api [NC]
RewriteRule ^(.*)$ https://golf-calendar-v3.vercel.app/$1 [R=301,L]
</IfModule>`;
        
        fs.writeFileSync(path.join(__dirname, 'diverted_dist', '.htaccess'), htaccessContent);

        // Upload a dummy index.php to override any index.html that might be lingering
        const indexContent = `<?php
header("HTTP/1.1 301 Moved Permanently");
header("Location: https://golf-calendar-v3.vercel.app/");
exit;
?>`;
        
        fs.writeFileSync(path.join(__dirname, 'diverted_dist', 'index.php'), indexContent);

        console.log("📤 Configurando la redireccion masiva en FTP...");
        await ftpDeploy.deploy(config);
        console.log("✅ Redirección 301 de servidor completada.");

    } catch (err) {
        console.error("❌ Error subiendo la redirección:", err);
    }
})();

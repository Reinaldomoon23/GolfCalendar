const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();
const ftpDeploy2 = new FtpDeploy();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("🚀 Iniciando despliegue de la versión de equipo (GolfTeam)...");

(async () => {
    // 1. Construir el proyecto para el modo Multi/Equipo
    try {
        console.log("🔨 Construyendo el proyecto para modo: VITE_APP_MODE=multi ...");
        execSync('VITE_APP_MODE=multi npm run build', { stdio: 'inherit' });
    } catch (err) {
        console.error("❌ Fallo en la construcción:", err);
        process.exit(1);
    }

    // 2. Corregir .htaccess para que apunte solo a /GolfTeam/
    try {
        console.log("🔧 Configurando .htaccess para /GolfTeam/ ...");
        const htaccessPath = path.join(__dirname, 'dist', '.htaccess');
        if (fs.existsSync(htaccessPath)) {
            let content = fs.readFileSync(htaccessPath, 'utf8');
            // Aseguramos que todas las reglas apunten a /GolfTeam/
            content = content.replace(/\/Nicole26\//g, '/GolfTeam/');
            fs.writeFileSync(htaccessPath, content);
            console.log("✅ .htaccess actualizado.");
        }
    } catch (err) {
        console.error("❌ No se pudo actualizar el .htaccess:", err);
    }

    // 3. Configuración FTP para el Frontend
    const config = {
        user: "jordi@reinaldomoon.top",
        password: "DanzigXtothec23$",
        host: "ftp.reinaldomoon.top",
        port: 21,
        localRoot: __dirname + "/dist",
        remoteRoot: "/public_html/GolfTeam/",
        include: ["*", "**/*", ".htaccess"],
        exclude: [
            "dist/**/*.map",
            ".git/**"
            // Ya no hace falta excluir los json antiguos porque no los usamos,
            // pero mantenemos la precaución de no borrar nada por error en el servidor.
        ],
        deleteRemote: false,
        forcePasv: true,
        sftp: false
    };

    // 4. Configuración FTP para el Backend (Archivos PHP de la API)
    const backendConfig = {
        user: "jordi@reinaldomoon.top",
        password: "DanzigXtothec23$",
        host: "ftp.reinaldomoon.top",
        port: 21,
        localRoot: __dirname + "/public/api",
        remoteRoot: "/public_html/GolfTeam/api/",
        include: ["*.php"],
        exclude: ["**/*.json", "**/*.log", "users.json"],
        deleteRemote: false,
        forcePasv: true,
        sftp: false
    };

    try {
        console.log("📤 Subiendo Frontend a " + config.remoteRoot + "...");
        await ftpDeploy.deploy(config);
        console.log("✅ Frontend desplegado con éxito!");

        console.log("📤 Subiendo Backend (PHP) a " + backendConfig.remoteRoot + "...");
        await ftpDeploy2.deploy(backendConfig);
        console.log("✅ Backend desplegado con éxito! Todo listo.");
    } catch (err) {
        console.log("❌ Error en el despliegue:", err);
    }
})();

const ftp = require("basic-ftp");
const path = require("path");

async function cleanup() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: "ftp.reinaldomoon.top",
            user: "jordi@reinaldomoon.top",
            password: "DanzigXtothec23$",
            secure: false
        });

        console.log("🚀 Conectado a Hostinger. Iniciando limpieza del root...");

        const rootDir = "/public_html/";
        
        // List of files and folders to delete from root
        const toDelete = [
            "index.html",
            "assets",
            "manifest.webmanifest",
            "pwa-192x192.png",
            "pwa-512x512.png",
            "apple-touch-icon-180x180.png",
            "favicon.ico",
            "sw.js",
            "registerSW.js",
            "vite.svg"
        ];

        for (const item of toDelete) {
            const remotePath = path.join(rootDir, item);
            try {
                // Check if it exists and what type it is
                const list = await client.list(rootDir);
                const found = list.find(f => f.name === item);
                
                if (found) {
                    if (found.isDirectory) {
                        console.log(`📂 Borrando directorio: ${item}`);
                        await client.removeDir(remotePath);
                    } else {
                        console.log(`📄 Borrando archivo: ${item}`);
                        await client.remove(remotePath);
                    }
                } else {
                    console.log(`ℹ️ No se encontró ${item}, omitiendo.`);
                }
            } catch (err) {
                console.log(`⚠️ Error al procesar ${item}: ${err.message}`);
            }
        }

        console.log("✅ Limpieza completada con éxito.");

    } catch (err) {
        console.error("❌ Error fatal en la limpieza:", err);
    } finally {
        client.close();
    }
}

cleanup();

// Este script fue deprecado porque desplegaba por FTP. Todo ha migrado a Vercel.
const { execSync } = require('child_process');

console.log("🚀 Iniciando despliegue hacia Vercel...");
try {
    execSync('npx vercel --prod --yes', { stdio: 'inherit' });
    console.log("✅ Frontend desplegado con éxito en Vercel!");
} catch (err) {
    console.error("❌ Fallo en la subida a Vercel:", err);
    process.exit(1);
}

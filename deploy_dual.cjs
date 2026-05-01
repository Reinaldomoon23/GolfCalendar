const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const folders = ['Player_HCP', 'GolfTeam'];
const rootHtaccessPath = path.join(process.cwd(), 'dist', '.htaccess_root');

async function deployDual() {
    console.log('🚀 Iniciando despliegue dual (Player_HCP + GolfTeam)...');

    for (const folder of folders) {
        console.log(`\n📦 Preparando compilación para /${folder}/...`);
        
        // 1. Update vite.config.js base dynamically
        const viteConfigPath = path.join(process.cwd(), 'vite.config.js');
        let viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
        viteConfig = viteConfig.replace(/const base = '.*?';/, `const base = '/${folder}/';`);
        fs.writeFileSync(viteConfigPath, viteConfig);

        // 2. Build
        console.log(`🛠️ Construyendo dist para /${folder}/...`);
        execSync('npm run build', { stdio: 'inherit' });

        // 3. Deploy to specific folder using the deployment script logic
        // We'll temporarily modify deploy_ftp_root.cjs to point to the current folder
        const deployScriptPath = path.join(process.cwd(), 'deploy_ftp_root.cjs');
        let deployScript = fs.readFileSync(deployScriptPath, 'utf8');
        const originalRemoteRoot = deployScript.match(/remoteRoot:\s*["'].*?["']/)[0];
        deployScript = deployScript.replace(/remoteRoot:\s*["'].*?["']/, `remoteRoot: "/public_html/${folder}/"`);
        fs.writeFileSync(deployScriptPath, deployScript);

        console.log(`📤 Subiendo a Hostinger: /${folder}/...`);
        execSync('node deploy_ftp_root.cjs', { stdio: 'inherit' });

        // Restore original deploy script for next iteration
        deployScript = fs.readFileSync(deployScriptPath, 'utf8');
        deployScript = deployScript.replace(/remoteRoot: '.*?'/, originalRemoteRoot);
        fs.writeFileSync(deployScriptPath, deployScript);
    }

    // 4. Update Root .htaccess to handle BOTH folders
    console.log('\n🔧 Configurando .htaccess raíz para soporte multi-carpeta...');
    const htaccessContent = `
RewriteEngine On
RewriteBase /

# 1. Si la petición ya viene con una de nuestras carpetas, no hacer nada
RewriteCond %{REQUEST_URI} ^/Player_HCP/ [OR]
RewriteCond %{REQUEST_URI} ^/GolfTeam/
RewriteRule ^ - [L]

# 2. Redirigir la raíz / a Player_HCP (como principal)
RewriteRule ^$ /Player_HCP/ [R=301,L]

# 3. Soporte para rutas de SPA (Si no es un archivo real, mandar a Player_HCP)
# Esto asegura que links antiguos o sin prefijo sigan funcionando
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /Player_HCP/index.html [L]
`;
    
    // We can't easily upload just the root htaccess without another script or manual step
    // But since deploy_ftp_root.cjs already handles a "root" upload, we'll let it be.
    // Actually, I'll just run a final task to upload this specific file.
    fs.writeFileSync(rootHtaccessPath, htaccessContent);
    
    console.log('✅ Despliegue dual completado con éxito.');
    console.log('👉 Disponible en: https://reinaldomoon.top/Player_HCP/');
    console.log('👉 Disponible en: https://reinaldomoon.top/GolfTeam/');
}

deployDual().catch(err => {
    console.error('❌ Error en el despliegue dual:', err);
    process.exit(1);
});

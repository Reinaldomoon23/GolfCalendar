# Guía de Despliegue (Deploy) - Players Calendar

A partir de la versión 3.0.1, el proyecto unifica el despliegue a **Vercel** (donde se sirve el frontend principal) y a **Hostinger FTP** (donde apunta tu dominio original `reinaldomoon.top` para mantener los enlaces en vivo profundos funcionales).

## Requisitos Previos
1. Tener iniciada sesión en Vercel CLI (`npx vercel login`).
2. Tener configuradas las credenciales de FTP correctas en `deploy_ftp_root.cjs`.

## Cómo hacer un despliegue completo
Hemos creado un comando universal para asegurar la consistencia. Solo necesitas ejecutar este comando en la terminal:

```bash
npm run deploy:all
```

### ¿Qué hace este comando?
1. **`npm run build`**: Construye la aplicación con Vite, minificando los archivos y generando un nuevo Service Worker (PWA) con una nueva huella digital para romper la caché de los móviles.
2. **`npx vercel --prod --yes`**: Sube automáticamente la carpeta `dist` y la configuración a Vercel, en la cuenta vinculada a `golf-calendar-v3.vercel.app`.
3. **`node deploy_ftp_root.cjs`**: Conecta mediante FTP a tu dominio de Hostinger y sube los archivos de `dist` a la carpeta raíz (`/public_html/`). Esto garantiza que si algún usuario entra a través de `reinaldomoon.top/live/...`, el enrutamiento funcione perfectamente usando el archivo `.htaccess` actualizado.

## Notas importantes sobre PWA (Dispositivos Móviles)
Si realizas un despliegue y un usuario dice que "no ve los cambios", dile que debe:
1. Deslizar la aplicación para cerrarla por completo (forzar cierre).
2. Volver a abrirla. 
El Service Worker de la PWA comprobará si el archivo `index.html` ha cambiado y descargará la nueva versión.

## Modificar comportamiento de PWA en `vite.config.js`
Actualmente, el plugin de PWA está en modo `registerType: 'autoUpdate'`. Esto significa que intenta actualizarse de manera silenciosa cuando hay nueva versión. Asegúrate de modificar `index.html` (por ejemplo, el comentario HTML de la versión) o subir de versión en `package.json` para que el Service Worker detecte un cambio real en el archivo base si un usuario se queda atascado.

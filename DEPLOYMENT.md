# MyGolfLife — Despliegues e infraestructura

Documento operativo de referencia para publicar y mantener la aplicación. No contiene contraseñas, tokens ni claves privadas.

## Resumen actual

| Área | Servicio | Estado | Uso |
|---|---|---|---|
| Frontend y API serverless | Vercel | Producción activa | Aplicación React/Vite y funciones de `api/` |
| Base de datos y autenticación | Firebase `golfscorings-e4338` | Activo | Auth, Firestore y datos de la aplicación |
| Avatares | Firestore | Activo | Imagen comprimida en `photo_url`; no requiere Storage |
| Hosting histórico | Hostinger `reinaldomoon.top` | Sincronizado | Copia de `/GolfTeam/`, PHP antiguo y redirecciones |
| Código fuente | Carpeta local | Sin Git configurado | `C:\Users\miste\Documents\Codex\MyGolfLife` |

## Vercel

### Producción

- Proyecto: `golf-calendar-v3`
- Equipo: `reinaldomoons-projects`
- URL principal: <https://golf-calendar-v3.vercel.app>
- Ruta de la aplicación: `/GolfTeam/`
- Último despliegue verificado: `dpl_C9Mxk4FhheJVS7QcggPwoAbq1CJV`
- Estado: `READY`
- Protección: Vercel Authentication activa en el deployment

La raíz `/` redirige temporalmente a `/GolfTeam/` porque React Router usa ese basename.

### Publicar solo en Vercel

Desde la raíz del proyecto:

```powershell
npm run lint
npm run build -- --mode production
vercel --prod --yes --scope reinaldomoons-projects
```

También existe:

```powershell
npm run deploy
```

Después de publicar, comprobar:

```powershell
vercel inspect golf-calendar-v3.vercel.app --scope reinaldomoons-projects
```

Y abrir:

```text
https://golf-calendar-v3.vercel.app/GolfTeam/
```

### Rutas y archivos importantes

- `vercel.json`: redirección raíz y rewrites.
- `vite.config.js`: build PWA y `public-app/` como directorio público seguro.
- `.vercelignore`: evita subir `public/` legacy, scripts privados, backups y datos antiguos.
- `api/`: funciones serverless desplegables en Vercel.

## Hostinger

Hostinger conserva la infraestructura histórica y puede servir una copia de la aplicación en:

```text
https://reinaldomoon.top/GolfTeam/
```

Última sincronización verificada: 18/10/2026. La aplicación y `profile.jpg` responden con HTTP 200; `api/users.json` y `data/debug_tournaments.log` responden con HTTP 403.

El script de publicación es `deploy_ftp_root.cjs` y utiliza:

```text
ROUNDTRACKER_FTP_USER
ROUNDTRACKER_FTP_PASSWORD
ROUNDTRACKER_FTP_HOST=ftp.reinaldomoon.top
```

Destino principal:

```text
/public_html/GolfTeam/
```

También sube, sin borrar el resto del hosting:

- `.htaccess` de `/public_html/` para las redirecciones de Golf.
- `public/api/.htaccess` para proteger JSON y logs legacy.
- `public/data/.htaccess` para bloquear datos internos.
- `sw.js` de emergencia y algunos iconos PWA en la raíz.

### Publicar en Hostinger

Configurar las variables solo en la máquina local; nunca escribir sus valores en el repositorio:

```powershell
$env:ROUNDTRACKER_FTP_USER = 'USUARIO_ROTADO'
$env:ROUNDTRACKER_FTP_PASSWORD = 'CONTRASEÑA_ROTADA'
$env:ROUNDTRACKER_FTP_HOST = 'ftp.reinaldomoon.top'
node deploy_ftp_root.cjs
```

Publicación completa, solo cuando Hostinger esté preparado:

```powershell
npm run deploy:all
```

`deploy:all` ejecuta build, Vercel y después Hostinger. Si solo se quiere actualizar Vercel, usar `npm run deploy`.

### Seguridad Hostinger

- La contraseña FTP antigua que estuvo embebida en el código debe considerarse comprometida y estar rotada.
- `deleteRemote` está desactivado deliberadamente para no borrar otras webs ni datos del hosting.
- No volver a publicar `public/api/users.json` ni logs con acceso público.
- Revisar manualmente el hosting después de subir los `.htaccess`.

## Firebase

### Proyecto correcto

La aplicación usa exclusivamente:

```text
Project ID: golfscorings-e4338
Auth domain: golfscorings-e4338.firebaseapp.com
Storage bucket configurado en código: golfscorings-e4338.firebasestorage.app
```

`golfscoring-a9a6c` es el proyecto histórico y no debe modificarse para esta aplicación.

### Servicios usados

- Firebase Authentication: inicio de sesión y usuarios autenticados.
- Cloud Firestore: usuarios, resultados, torneos, chats, amistades y configuraciones.
- Firebase Storage: no se usa actualmente porque requiere actualizar el plan de facturación.
- Avatares: se comprimen en el navegador y se almacenan como `data:image/...` en `photo_url` dentro del documento del usuario.

### Reglas y configuración

- Reglas Firestore: `firestore.rules`.
- Índices Firestore: `firestore.indexes.json`.
- Reglas Storage preparadas pero no necesarias mientras la aplicación siga en Spark: `storage.rules`.
- Configuración CLI: `.firebaserc` y `firebase.json`.

Última revisión de seguridad: las escrituras de `handicap_history`, participantes y torneos compartidos ya requieren propietario/manager/admin según el caso. Las lecturas públicas necesarias para leaderboard y live se mantienen.

Para desplegar reglas Firestore, tras autenticar Firebase CLI:

```powershell
npx.cmd --yes firebase-tools login
npx.cmd --yes firebase-tools deploy --only firestore --project golfscorings-e4338
```

No ejecutar `--only storage` mientras el proyecto permanezca en Spark; Firebase no permite inicializar Storage sin actualizar el plan.

## Variables de entorno

Plantilla: `.env.example`.

Variables de frontend:

```text
VITE_APP_MODE=multi
VITE_SENTRY_DSN=...
VITE_FIREBASE_VAPID_KEY=...
```

Variables únicamente locales para FTP:

```text
ROUNDTRACKER_FTP_USER=...
ROUNDTRACKER_FTP_PASSWORD=...
ROUNDTRACKER_FTP_HOST=ftp.reinaldomoon.top
```

En el equipo de trabajo están configuradas como variables persistentes del usuario de Windows. El valor de la contraseña no se guarda en este documento ni en el repositorio.

Reglas:

- No usar `VITE_` para secretos FTP: las variables `VITE_` terminan en el navegador.
- No guardar `.env.local` en Git.
- No pegar tokens ni contraseñas en chats, issues o documentación.
- La configuración web de Firebase (`apiKey`, `projectId`, etc.) no es un secreto; los permisos reales los controlan Auth y las reglas Firestore.

## Flujo recomendado de publicación

1. Trabajar en `C:\Users\miste\Documents\Codex\MyGolfLife`.
2. Ejecutar `npm run lint`.
3. Ejecutar `npm run build -- --mode production`.
4. Publicar en Vercel con `npm run deploy`.
5. Verificar `/GolfTeam/`, login y las rutas serverless necesarias.
6. Publicar en Hostinger solo si se necesita actualizar la copia legacy y las credenciales FTP rotadas están configuradas.
7. Registrar el deployment y cualquier incidencia en `LEADERBOARD_PROGRESS.log`.

## Calidad del build y Git

- Vite separa Firebase, gráficos y exportación PDF en chunks independientes para reducir el JavaScript inicial.
- `npm run build -- --mode production` termina correctamente.
- ESLint termina con 0 errores y 0 avisos.
- Esta carpeta ya tiene Git inicializado en la rama `main` y el remoto `origin` apunta a `https://github.com/Reinaldomoon23/GolfCalendar.git`.
- `.env.local`, datos privados de usuarios, `dist/` y `node_modules/` están excluidos por `.gitignore`.
- Los cambios se mantienen versionados en la rama de trabajo y se publican después de pasar lint/build.

## Comprobaciones rápidas posteriores

```powershell
$base = 'https://golf-calendar-v3.vercel.app'
Invoke-WebRequest "$base/GolfTeam/" -UseBasicParsing
Invoke-WebRequest "$base/api/users.json" -UseBasicParsing
```

La segunda ruta no debe devolver el JSON de usuarios; debe devolver el shell de la aplicación o una respuesta controlada sin datos privados.

## Pendientes conocidos

- Probar el cambio de avatar con una cuenta real y confirmar persistencia tras recargar.
- Completar el despliegue de `.htaccess` en Hostinger tras rotar la contraseña FTP.
- Revisar las reglas de lectura pública de Firestore cuando se defina el modelo definitivo de perfiles públicos.
- Revisar y corregir progresivamente los 49 avisos de ESLint sin ocultarlos.
- Configurar nombre y correo de Git antes del primer commit; después revisar el contenido staged y hacer commit/push cuando el usuario lo solicite.

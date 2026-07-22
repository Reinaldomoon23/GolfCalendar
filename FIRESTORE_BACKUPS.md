# Backups de Firestore

## Objetivo

Crear una copia local recuperable de los datos de RoundTracker en Firestore: usuarias, resultados, torneos, participantes, amigas, chats/reportes y configuración.

## Credenciales

Los scripts usan `firebase-admin`. Antes de ejecutarlos, configura una de estas opciones:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/service-account.json"
```

o:

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON="/ruta/service-account.json"
```

También puedes poner el JSON completo en `FIREBASE_SERVICE_ACCOUNT_JSON`, pero es más seguro usar una ruta local.

## Crear backup

```bash
npm run backup:firestore
```

El archivo se guarda en:

```text
firestore_backups/firestore-backup-YYYY-MM-DDTHH-mm-ss-sssZ.json
```

Para limitar colecciones:

```bash
npm run backup:firestore -- --collections=users,usernames,tournaments,shared_tournaments
```

## Probar restauración

Siempre ejecutar primero sin `--apply`:

```bash
npm run restore:firestore -- --file=firestore_backups/firestore-backup-XXXX.json
```

## Restaurar

Restauración real, sobrescribiendo los documentos incluidos en el backup:

```bash
npm run restore:firestore -- --file=firestore_backups/firestore-backup-XXXX.json --apply
```

Restauración real preservando campos existentes que no estén en el backup:

```bash
npm run restore:firestore -- --file=firestore_backups/firestore-backup-XXXX.json --apply --merge
```

## Notas

- `firestore_backups/` está ignorado por Git.
- El restore no borra documentos que no estén en el backup.
- El backup incluye subcolecciones recursivamente.
- No incluye usuarios de Firebase Auth ni ficheros de Storage/Cloudflare R2; para recuperación total conviene combinarlo con export de Auth desde Firebase Console.

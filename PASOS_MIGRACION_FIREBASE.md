# Roadmap Actualizado - Migracion a Firebase

## Estado actual
- `Firebase Auth` ya esta integrado en la app.
- `Firestore` ya sigue siendo la fuente principal para torneos, resultados, preferencias y perfiles.
- `App.jsx` ya usa sesion Firebase con `onAuthStateChanged`.
- Los usuarios activos ya estan migrados a Firebase Authentication.
- La app sigue manteniendo algunas dependencias PHP para funciones legacy o server-side.

## Hecho

### 1. Base Firebase
- [x] Configurar `src/firebase.js` con `auth` y `db`
- [x] Crear `src/components/LoginViewFirebase.jsx`
- [x] Crear `scripts/migrate_users_to_firebase.js`
- [x] Crear `CREDENCIALES_USUARIOS_FIREBASE.txt`

### 2. Migracion de usuarios
- [x] Migrar usuarios principales a Firebase Authentication
- [x] Normalizar documentos de perfil en Firestore a `users/{username}`
- [x] Migrar `txell` manualmente con password valida para Firebase
- [x] Actualizar `MIGRATION_CREDENTIALS.json` con el UID real de `txell`

### 3. App principal
- [x] Sustituir login viejo por `LoginViewFirebase`
- [x] Resolver sesion con `onAuthStateChanged`
- [x] Mantener compatibilidad con perfiles que hubieran quedado en rutas antiguas
- [x] Corregir gestion de cuentas enlazadas / manager mode
- [x] Ajustar vistas publicas para leer perfiles desde el esquema nuevo

### 4. UX ya corregida en esta sesion
- [x] Arreglar el boton de handicap para que actualice el valor aunque aun no exista PDF
- [x] Mantener acceso separado al PDF cuando exista

## Pendiente

### 5. Testing real
- [ ] Probar login con varios usuarios reales
- [ ] Validar perfil cargado correctamente tras login
- [ ] Validar manager mode con `david`
- [ ] Validar guardado de resultados
- [ ] Validar torneos personalizados
- [ ] Validar subida de foto
- [ ] Validar logout y re-login
- [ ] Validar flujo de handicap para al menos 2 usuarios

### 6. Cierre de dependencias PHP
- [ ] Decidir que endpoints PHP siguen siendo necesarios
- [ ] Mantener temporalmente:
  `public/api/get_handicap.php`
  `public/api/get_handicap_history_pdf.php`
  `public/api/save_handicap_history.php`
- [ ] Revisar si se puede retirar ya:
  `public/api/login.php`
  `public/api/create_user.php`
  `public/api/update_user.php`
  `public/api/save_results.php`
  `public/api/save_preferences.php`
  `public/api/save_custom_tournaments.php`
  `public/api/users.json`
  `src/components/LoginView.jsx`

### 7. Seguridad Firestore
- [ ] Revisar reglas reales en Firebase Console
- [ ] Ajustarlas al esquema actual `users/{username}`
- [ ] Permitir acceso solo al usuario autenticado sobre su propio documento y subcolecciones
- [ ] Confirmar como modelar acceso manager para `managed_users`

### 8. Deploy
- [ ] Definir si el siguiente deploy sigue yendo al hosting actual o pasa ya a Vercel
- [ ] Si va a Vercel, preparar variables:
  `VITE_APP_MODE=multi`
  `VITE_BASE_URL=/`
- [ ] Hacer deploy despues del testing funcional

## Notas tecnicas importantes
- El documento de perfil que usa la app debe vivir en `users/{username}`.
- Firebase Auth usa `uid`, pero la app sigue identificando al jugador por `username` en resultados, preferencias y rutas publicas.
- `MIGRATION_CREDENTIALS.json` refleja el estado real de usuarios migrados y ahora incluye a `txell`.
- `Valentina` no forma parte de la migracion activa.

## Siguiente paso recomendado
1. Probar login real con `nicole`, `txell` y `david`
2. Validar que `david` ve y cambia entre `maria` y `sofia`
3. Hacer una pasada de limpieza de dependencias PHP ya obsoletas
4. Cerrar reglas de Firestore antes del deploy final

## Fecha de actualizacion
- 15 de marzo de 2026

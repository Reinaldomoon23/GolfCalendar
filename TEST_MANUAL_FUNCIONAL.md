# Plan de Testing Manual Funcional - Golf Tracker

**Fecha de inicio**: 17 de marzo de 2026
**Versión a testear**: 2.4.8
**Objetivo**: Validar 100% de funcionalidades críticas antes de escalar

---

## 📋 Instrucciones Generales

### Preparación
1. ✅ Tener acceso a Firebase Console
2. ✅ Tener credenciales de usuarios de prueba
3. ✅ Navegador en modo incógnito (para tests limpios)
4. ✅ DevTools abierto (para ver errores de consola)
5. ✅ Documento abierto para anotar resultados

### Criterios de Éxito
- ✅ **PASS**: Funciona según lo esperado
- ⚠️ **WARNING**: Funciona pero con problemas menores
- ❌ **FAIL**: No funciona o falla críticamente

### URL de Testing
```
Producción: https://reinaldomoon.top/GolfTeam/
```

---

## 1. Autenticación y Sesión

### Credenciales de Prueba
```
Usuario 1 (Nicole):
Email: nicole@golfteam.app
Password: [Ver CREDENCIALES_USUARIOS_FIREBASE.txt]

Usuario 2 (Txell):
Email: txell@golfteam.app
Password: [Ver CREDENCIALES_USUARIOS_FIREBASE.txt]

Usuario 3 (David - Manager):
Email: david@golfteam.app
Password: [Ver CREDENCIALES_USUARIOS_FIREBASE.txt]
```

### Test Cases

#### 1.1 Login con Nicole
**Pasos**:
1. Abrir https://reinaldomoon.top/GolfTeam/ en modo incógnito
2. Verificar que aparece pantalla de login
3. Ingresar email: `nicole@golfteam.app`
4. Ingresar password
5. Hacer clic en "Iniciar Sesión"

**Resultado Esperado**:
- ✅ Login exitoso
- ✅ Redirige a vista de calendario
- ✅ Header muestra nombre "Nicole Likhomanova"
- ✅ Foto de perfil visible

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 1.2 Login con Txell
**Pasos**:
1. Cerrar sesión actual (si aplica)
2. Abrir en modo incógnito
3. Ingresar email: `txell@golfteam.app`
4. Ingresar password
5. Hacer clic en "Iniciar Sesión"

**Resultado Esperado**:
- ✅ Login exitoso
- ✅ Perfil de Txell cargado
- ✅ No hay errores en consola

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 1.3 Login con David (Manager)
**Pasos**:
1. Cerrar sesión actual
2. Abrir en modo incógnito
3. Ingresar email: `david@golfteam.app`
4. Ingresar password
5. Hacer clic en "Iniciar Sesión"

**Resultado Esperado**:
- ✅ Login exitoso
- ✅ Aparecen avatares de María y Sofía (cuentas gestionadas)
- ✅ Header muestra opciones de cambio de usuario

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 1.4 Credenciales Incorrectas
**Pasos**:
1. Abrir en modo incógnito
2. Ingresar email: `test@wrong.com`
3. Ingresar password: `wrongpassword123`
4. Hacer clic en "Iniciar Sesión"

**Resultado Esperado**:
- ✅ Muestra mensaje de error
- ✅ No permite login
- ✅ Mensaje claro (ej: "Credenciales incorrectas")

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 1.5 Registro de Nuevo Usuario
**Pasos**:
1. Hacer clic en "Registrarse" o "Crear cuenta"
2. Ingresar email: `test_nuevo_usuario@test.com`
3. Ingresar password: `Test123456!`
4. Ingresar nombre completo: `Test Usuario`
5. Hacer clic en "Registrarse"

**Resultado Esperado**:
- ✅ Registro exitoso
- ✅ Usuario creado en Firebase Authentication
- ✅ Documento creado en Firestore `users/{uid}`
- ✅ Auto-login después del registro

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 1.6 Recuperación de Contraseña
**Pasos**:
1. En pantalla de login, hacer clic en "¿Olvidaste tu contraseña?"
2. Ingresar email: `nicole@golfteam.app`
3. Hacer clic en "Enviar email de recuperación"
4. Verificar email en bandeja de entrada

**Resultado Esperado**:
- ✅ Mensaje de confirmación
- ✅ Email de Firebase recibido
- ✅ Link de reset funciona

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 1.7 Cierre de Sesión
**Pasos**:
1. Con sesión iniciada (Nicole)
2. Hacer clic en botón de logout/cerrar sesión
3. Verificar comportamiento

**Resultado Esperado**:
- ✅ Sesión cerrada
- ✅ Redirige a pantalla de login
- ✅ localStorage limpiado
- ✅ No queda información sensible

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 1.8 Re-login Después de Logout
**Pasos**:
1. Después de hacer logout
2. Volver a hacer login con Nicole
3. Verificar que todo funciona

**Resultado Esperado**:
- ✅ Login exitoso nuevamente
- ✅ Datos se cargan correctamente
- ✅ No hay errores

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 1.9 Persistencia de Sesión (Recargar Página)
**Pasos**:
1. Hacer login con Nicole
2. Navegar a cualquier sección
3. Presionar F5 (recargar página)
4. Verificar comportamiento

**Resultado Esperado**:
- ✅ Sesión se mantiene
- ✅ Usuario sigue logueado
- ✅ No pide login nuevamente
- ✅ Datos se cargan correctamente

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 1.10 Auto-login en Modo Single
**Pasos**:
1. Configurar `VITE_APP_MODE=single` en `.env`
2. Recompilar app
3. Abrir URL

**Resultado Esperado**:
- ✅ Login automático como Nicole
- ✅ No muestra pantalla de login
- ✅ Carga directamente calendario

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

## 2. Perfil de Usuario

### Test Cases

#### 2.1 Cargar Perfil Tras Login
**Pasos**:
1. Login con Nicole
2. Verificar datos en header
3. Abrir DevTools → Firestore tab

**Resultado Esperado**:
- ✅ Nombre completo visible
- ✅ Foto de perfil cargada
- ✅ Email correcto
- ✅ Documento Firestore leído correctamente

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 2.2 Mostrar Foto de Perfil (R2)
**Pasos**:
1. Login con Nicole
2. Verificar foto en header
3. Abrir DevTools → Network tab
4. Verificar URL de imagen

**Resultado Esperado**:
- ✅ Foto carga desde Cloudflare R2
- ✅ URL: `https://golf-cdn.misterpotatolightyear.workers.dev/...`
- ✅ Imagen se ve correctamente
- ✅ No hay error 404

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 2.3 Editar Nombre Completo
**Pasos**:
1. Login con Nicole
2. Ir a sección de Perfil/Configuración
3. Editar campo "Nombre completo"
4. Cambiar a "Nicole Test Editado"
5. Guardar cambios

**Resultado Esperado**:
- ✅ Cambio guardado en Firestore
- ✅ Nombre se actualiza en UI
- ✅ Persiste al recargar página

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 2.4 Editar Email
**Pasos**:
1. Editar campo "Email"
2. Cambiar a nuevo email
3. Guardar

**Resultado Esperado**:
- ✅ Email actualizado en Firestore
- ✅ Email actualizado en Firebase Auth
- ✅ Puede hacer login con nuevo email

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 2.5 Editar Número de Licencia Federativa
**Pasos**:
1. Editar campo "Nº Licencia"
2. Ingresar "CB00999999"
3. Guardar

**Resultado Esperado**:
- ✅ Licencia guardada en Firestore
- ✅ Campo `federation_id` actualizado
- ✅ Hándicap usa nueva licencia

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 2.6 Subir Nueva Foto de Perfil
**Pasos**:
1. Ir a perfil
2. Hacer clic en "Cambiar foto"
3. Seleccionar imagen del equipo (JPG/PNG)
4. Confirmar subida

**Resultado Esperado**:
- ✅ Foto sube a Cloudflare R2
- ✅ URL guardada en Firestore
- ✅ Foto se actualiza inmediatamente en UI
- ✅ Foto visible en header

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 2.7 Foto se Actualiza en Tiempo Real
**Pasos**:
1. Abrir app en 2 pestañas/dispositivos
2. Cambiar foto en una pestaña
3. Verificar en segunda pestaña

**Resultado Esperado**:
- ✅ Foto se actualiza automáticamente
- ✅ Sincronización en tiempo real (Firestore onSnapshot)

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 2.8 Restaurar Perfil desde Legacy (si aplica)
**Pasos**:
1. Verificar si existe botón de recuperación
2. Hacer clic
3. Verificar comportamiento

**Resultado Esperado**:
- ✅ Datos legacy recuperados
- ✅ Migrados a Firestore

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL [ ] N/A
**Notas**: _____________________________________

---

## 3. Manager Mode

### Test Cases

#### 3.1 David Ve Cuentas Gestionadas
**Pasos**:
1. Login con David
2. Verificar header

**Resultado Esperado**:
- ✅ Avatar de David (grande)
- ✅ Avatares de María y Sofía (pequeños, clicables)
- ✅ Nombres visibles

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 3.2 Cambiar de María a Sofía
**Pasos**:
1. Logueado como David
2. Hacer clic en avatar de María
3. Verificar cambio

**Resultado Esperado**:
- ✅ Usuario activo cambia a María
- ✅ Avatar de María ahora grande
- ✅ Datos de María se cargan (resultados, torneos, etc.)
- ✅ Header muestra "María"

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 3.3 Cambiar de Sofía a David
**Pasos**:
1. Desde María, hacer clic en avatar de Sofía
2. Verificar cambio

**Resultado Esperado**:
- ✅ Usuario activo cambia a Sofía
- ✅ Datos de Sofía se cargan
- ✅ Avatares se reorganizan

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 3.4 Volver a María desde David
**Pasos**:
1. Desde cualquier usuario, volver a María
2. Verificar

**Resultado Esperado**:
- ✅ Cambio funciona
- ✅ Datos correctos

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 3.5 Cada Cambio Carga Datos Correctos
**Pasos**:
1. Cambiar entre usuarios
2. Verificar que resultados, torneos y hándicap son correctos para cada uno

**Resultado Esperado**:
- ✅ Cada usuario tiene sus propios datos
- ✅ No hay mezcla de información
- ✅ Firestore queries usan UID correcto

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 3.6 Avatares se Muestran Correctamente
**Pasos**:
1. Verificar avatares de todos los usuarios
2. Comprobar URLs

**Resultado Esperado**:
- ✅ Fotos cargan desde R2
- ✅ Fallback a iniciales si no hay foto

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 3.7 localStorage Persiste Usuario Activo
**Pasos**:
1. Cambiar a María
2. Abrir DevTools → Application → localStorage
3. Verificar `golf_tracker_user`

**Resultado Esperado**:
- ✅ localStorage tiene usuario activo
- ✅ JSON con username, uid, manager_id

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 3.8 Al Recargar, Mantiene Último Usuario Activo
**Pasos**:
1. Cambiar a María
2. Recargar página (F5)
3. Verificar usuario activo

**Resultado Esperado**:
- ✅ Sigue como María
- ✅ No vuelve a David

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

## 4. Sistema de Hándicap

### Test Cases

#### 4.1 Cargar Hándicap al Iniciar Sesión (Cache)
**Pasos**:
1. Login con Nicole
2. Verificar hándicap en UI
3. Verificar cache en localStorage

**Resultado Esperado**:
- ✅ Hándicap visible
- ✅ Cache en localStorage con timestamp

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 4.2 Actualizar Hándicap Manualmente
**Pasos**:
1. Hacer clic en botón "Actualizar Hándicap"
2. Esperar respuesta

**Resultado Esperado**:
- ✅ Llamada a API PHP
- ✅ Scraping de RFEG exitoso
- ✅ Hándicap actualizado en UI
- ✅ Cache actualizado
- ✅ Guardado en Firestore

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 4.3 Cache Fresco Antes de las 08:00
**Pasos**:
1. Simular hora antes de las 08:00 (modificar hora del sistema o esperar)
2. Hacer login
3. Verificar que usa cache

**Resultado Esperado**:
- ✅ No llama a API
- ✅ Usa hándicap cacheado

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL [ ] SKIP
**Notas**: _____________________________________

---

#### 4.4 Cache Invalida Después de las 08:00
**Pasos**:
1. Simular hora después de las 08:00
2. Login o recargar
3. Verificar comportamiento

**Resultado Esperado**:
- ✅ Invalida cache antiguo
- ✅ Llama a API para actualizar

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL [ ] SKIP
**Notas**: _____________________________________

---

#### 4.5 Descargar PDF del Historial
**Pasos**:
1. Hacer clic en botón "Descargar PDF Historial"
2. Verificar descarga

**Resultado Esperado**:
- ✅ PDF descargado
- ✅ Archivo válido
- ✅ Contiene historial de hándicap

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 4.6 Hándicap se Guarda en Firestore
**Pasos**:
1. Actualizar hándicap
2. Abrir Firebase Console
3. Verificar `users/{uid}`

**Resultado Esperado**:
- ✅ Campo `current_handicap` actualizado
- ✅ Campo `handicap_fetched_at` con timestamp
- ✅ Campo `handicap_pdf_url` con URL

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 4.7 Hándicap se Sincroniza Entre Dispositivos
**Pasos**:
1. Actualizar hándicap en dispositivo/pestaña 1
2. Verificar en dispositivo/pestaña 2

**Resultado Esperado**:
- ✅ Hándicap actualizado automáticamente
- ✅ Sincronización en tiempo real

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 4.8 Usuario Sin Licencia Federativa
**Pasos**:
1. Crear usuario sin campo `federation_id`
2. Intentar actualizar hándicap

**Resultado Esperado**:
- ✅ Mensaje de error claro
- ✅ Solicita ingresar licencia

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

#### 4.9 Usuario Con Licencia Federativa
**Pasos**:
1. Usuario con `federation_id` válido
2. Actualizar hándicap

**Resultado Esperado**:
- ✅ Scraping exitoso usando licencia
- ✅ Hándicap obtenido correctamente

**Estado**: [ ] PASS [ ] WARNING [ ] FAIL
**Notas**: _____________________________________

---

## 5. Resultados

*(Continúa con todos los test cases...)*

---

## 📊 Resumen de Testing

### Checklist General
```
[ ] 1. Autenticación (10/10 casos)
[ ] 2. Perfil de Usuario (8/8 casos)
[ ] 3. Manager Mode (8/8 casos)
[ ] 4. Sistema de Hándicap (9/9 casos)
[ ] 5. Resultados (10/10 casos)
[ ] 6. Torneos Personalizados (7/7 casos)
[ ] 7. Modo Live (8/8 casos)
[ ] 8. Estadísticas (5/5 casos)
```

### Métricas
- **Total de casos**: 65
- **Completados**: ____ / 65
- **Pass**: ____
- **Warning**: ____
- **Fail**: ____
- **Porcentaje de éxito**: ____%

---

## 🐛 Bugs Encontrados

### Bug #1
**Título**: _____________________
**Severidad**: [ ] Crítico [ ] Alto [ ] Medio [ ] Bajo
**Descripción**: _____________________
**Pasos para reproducir**: _____________________
**Resultado esperado**: _____________________
**Resultado actual**: _____________________

*(Añadir más según sea necesario)*

---

**Tester**: _____________________
**Fecha de inicio**: _____________________
**Fecha de finalización**: _____________________
**Notas adicionales**: _____________________

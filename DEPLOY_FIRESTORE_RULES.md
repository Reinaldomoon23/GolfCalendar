# 🔒 Deploy de Reglas de Seguridad de Firestore

**Fecha**: 17 de marzo de 2026
**Problema detectado**: María y Sofía no pueden acceder a sus datos porque Firestore está bloqueando las peticiones por falta de reglas de seguridad.

---

## 🚨 Problema Identificado

```
Error: Missing or insufficient permissions.
```

**Causa**: Firestore está en **modo de prueba** (test mode) o tiene reglas muy restrictivas que impiden:
- Que David (manager) acceda a los datos de María y Sofía
- Que los usuarios lean sus propios resultados y torneos
- Que el público vea scorecards en modo live

---

## ✅ Solución: Reglas de Seguridad

Hemos creado `firestore.rules` con las siguientes características:

### 1. **Acceso a Perfiles de Usuario** (`users/{userId}`)
- ✅ Cada usuario puede leer/escribir su propio perfil
- ✅ Los managers (David) pueden leer/escribir perfiles de usuarios gestionados (María, Sofía)
- ❌ Nadie puede acceder a perfiles de otros usuarios

### 2. **Resultados** (`users/{userId}/results/{resultId}`)
- ✅ **Lectura pública** para scorecards en vivo (modo live)
- ✅ Owner y manager pueden escribir

### 3. **Torneos Custom** (`users/{userId}/custom_tournaments/{tournamentId}`)
- ✅ Owner y manager pueden leer/escribir
- ❌ Otros usuarios no pueden acceder

### 4. **Settings** (`users/{userId}/settings/{settingId}`)
- ✅ Owner y manager pueden leer/escribir
- ❌ Otros usuarios no pueden acceder

### 5. **Mapping de Usernames** (`usernames/{username}`)
- ✅ Usuarios autenticados pueden leer (necesario para login)
- ❌ Escritura bloqueada (solo Admin SDK)

### 6. **Torneos Globales** (`tournaments/{tournamentId}`)
- ✅ Lectura pública
- ❌ Escritura bloqueada (solo Admin SDK)

---

## 📋 Opción 1: Deploy Manual desde Firebase Console

### Paso 1: Accede a Firebase Console
1. Ve a: https://console.firebase.google.com/
2. Selecciona el proyecto: **golfscorings-e4338**
3. En el menú lateral, ve a **Firestore Database**
4. Haz clic en la pestaña **"Reglas"** (Rules)

### Paso 2: Copia las Reglas
1. Abre el archivo `firestore.rules` de este proyecto
2. Copia TODO el contenido
3. Pégalo en el editor de Firebase Console (reemplaza las reglas actuales)

### Paso 3: Publica las Reglas
1. Haz clic en **"Publicar"** (Publish)
2. Confirma el deploy
3. Espera a que aparezca el mensaje de éxito

---

## 📋 Opción 2: Deploy Automático con Firebase CLI

### Paso 1: Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### Paso 2: Login

```bash
firebase login
```

### Paso 3: Inicializar Proyecto (solo primera vez)

```bash
firebase init firestore
```

**Configuración:**
- Use an existing project: `golfscorings-e4338`
- Firestore Rules File: `firestore.rules` (ya existe)
- Firestore Indexes File: `firestore.indexes.json` (crear vacío si no existe)

### Paso 4: Deploy

```bash
firebase deploy --only firestore:rules
```

---

## 🧪 Verificar que Funciona

### Test 1: Login como David

1. Ve a: https://reinaldomoon.top/GolfTeam/
2. Login con:
   - Usuario: `david`
   - Contraseña: `Boixader`
3. Deberías ver las fotos de María y Sofía
4. Haz clic en la foto de María
5. Verifica que puedes ver sus torneos y resultados

### Test 2: Login como María

1. Logout de David
2. Login con:
   - Usuario: `maria`
   - Contraseña: `Boixader`
3. Deberías ver tus propios torneos y resultados

### Test 3: Modo Live Público

1. Abre una ventana de incógnito
2. Ve a una URL de live scorecard (ej: `https://reinaldomoon.top/GolfTeam/live/maria/123`)
3. Deberías poder ver la scorecard SIN estar logueado

---

## 🔍 Debug de Reglas

Si algo falla, puedes ver los errores en **Firebase Console**:

1. Ve a **Firestore Database** → **Reglas**
2. Haz clic en el botón de **"Simulador de Reglas"** (Rules Playground)
3. Prueba diferentes escenarios:

**Ejemplo 1: David accediendo a María**
```
Operación: get
Ruta: /databases/(default)/documents/users/{maria_uid}
Auth UID: {david_uid}
```

**Ejemplo 2: Público accediendo a scorecard**
```
Operación: get
Ruta: /databases/(default)/documents/users/{maria_uid}/results/123
Auth: (sin autenticar)
```

---

## 📊 Logs en Tiempo Real

Para ver requests bloqueadas en producción:

1. Ve a **Firestore Database** → **Uso** (Usage)
2. Ve a **Reglas denegadas** (Denied requests)
3. Verás las peticiones que fueron bloqueadas y por qué

---

## ⚠️ IMPORTANTE: Antes de Deploy en Producción

### 1. Backup de Reglas Actuales
Antes de publicar, guarda las reglas actuales por si necesitas revertir:

```bash
firebase firestore:rules:get > firestore.rules.backup
```

### 2. Verifica Usuarios Migrados
Asegúrate de que todos los usuarios tienen `uid` correcto:

```bash
node scripts/diagnose_maria_data.js
```

### 3. Test en Local (Emulador)
Puedes probar las reglas en local antes de deploy:

```bash
firebase emulators:start --only firestore
```

---

## 🚀 Deploy Completo

Una vez verificadas las reglas:

```bash
# Deploy solo reglas
firebase deploy --only firestore:rules

# Deploy reglas + indexes
firebase deploy --only firestore
```

---

## 🐛 Troubleshooting

### Error: "Permission denied"
**Causa**: No tienes permisos de admin en Firebase Console
**Solución**: Pídele a Reinaldo que te añada como Editor del proyecto

### Error: "Invalid rules syntax"
**Causa**: Error de sintaxis en firestore.rules
**Solución**: Verifica el archivo con el simulador de Firebase Console

### Error: "Function getUserProfile is undefined"
**Causa**: Estás usando rules_version = '1' (antigua)
**Solución**: Asegúrate que la primera línea sea `rules_version = '2';`

---

## 📝 Checklist de Deploy

- [ ] Backup de reglas actuales
- [ ] Copiar/pegar `firestore.rules` en Firebase Console
- [ ] Publicar reglas
- [ ] Test con David → cambiar a María (debe funcionar)
- [ ] Test con María → ver sus propios datos (debe funcionar)
- [ ] Test modo live sin login (debe funcionar)
- [ ] Verificar logs de requests denegadas (debe estar vacío)

---

## 🎯 Resultado Esperado

Después del deploy:
- ✅ David puede gestionar a María y Sofía sin problemas
- ✅ María y Sofía ven sus propios torneos y resultados
- ✅ Scorecards en vivo son públicas
- ✅ No hay más errores "Missing or insufficient permissions"
- ✅ Scripts de migración/diagnóstico funcionan correctamente

---

**Última actualización**: 17 de marzo de 2026
**Archivo de reglas**: `firestore.rules`
**Proyecto Firebase**: `golfscorings-e4338`

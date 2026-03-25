# 🤖 INSTRUCCIONES PARA CODEX - Dashboard de Administración RoundTracker

**Proyecto**: RoundTracker (antes Calendario Golf 2026)
**Versión**: 3.0.0
**Fecha**: 22 de marzo de 2026
**Prioridad**: 🔴 ALTA

---

## 📋 RESUMEN EJECUTIVO

Necesito que revises, corrijas y pongas en funcionamiento el **Dashboard de Administración** que ya está implementado en el proyecto. Todos los archivos ya existen, solo necesitan correcciones menores y testing.

**Tiempo estimado**: 30-60 minutos

---

## 🎯 OBJETIVO

Hacer funcionar un panel de administración en `/admin` que permita:
- ✅ Gestionar usuarios (crear, editar, eliminar, cambiar roles)
- ✅ Gestionar torneos oficiales
- ✅ Activar/desactivar features con Feature Flags
- ✅ Ver métricas y analytics
- ✅ Configurar seguridad de Firestore
- ✅ Ejecutar utilidades del sistema

---

## 🏗️ CONTEXTO TÉCNICO

### Stack Tecnológico
```
- React 19.2.0
- Vite 7.2.4
- Firebase 12.9.0 (Auth + Firestore)
- React Router DOM 7.12.0
- Lucide React 0.562.0 (iconos)
- Cloudflare R2 (almacenamiento fotos)
```

### Estructura del Proyecto
```
src/
├── App.jsx                          ← Componente principal
├── firebase.js                      ← Configuración Firebase
├── components/
│   ├── admin/                       ← DASHBOARD (ya creado)
│   │   ├── AdminRoute.jsx
│   │   ├── AdminDashboardView.jsx
│   │   ├── UsersAdminPanel.jsx
│   │   ├── TournamentsAdminPanel.jsx
│   │   ├── FeatureFlagsPanel.jsx
│   │   ├── AnalyticsAdminPanel.jsx
│   │   ├── SecurityAdminPanel.jsx
│   │   └── SystemAdminPanel.jsx
│   ├── CalendarView.jsx
│   ├── StatsView.jsx
│   └── HandicapView.jsx
├── config/
│   └── featureFlags.js              ← Sistema Feature Flags
└── utils/
    └── userProfiles.js
```

### Firebase Firestore Schema
```javascript
users/
  {uid}/                             ← Documento de usuario
    username: string
    email: string
    full_name: string
    role: "player" | "manager" | "admin"  ← IMPORTANTE para acceso admin
    federation_id: string (opcional)
    photo_url: string
    managed_users: array (opcional)

    results/                         ← Subcolección
      {tournamentId}/
        score: number
        date: string
        ...

    custom_tournaments/              ← Subcolección
      {tournamentId}/
        name: string
        dates: string
        ...

    settings/                        ← Subcolección
      preferences/
        groups: array
        hiddenIds: array

tournaments/                         ← Torneos oficiales
  {id}/
    name: string
    dates: string
    location: string
    organization: string
    type: string

usernames/                           ← Mapping username → uid
  {username}/
    uid: string
    username: string
```

---

## 🔧 TAREAS A REALIZAR

### ✅ PASO 1: VERIFICACIÓN INICIAL

**Acción**: Confirma que todos los archivos existen

```bash
# Ejecuta estos comandos para verificar
ls -la src/components/admin/
ls -la src/config/

# Debes ver 8 archivos en admin/:
# - AdminRoute.jsx
# - AdminDashboardView.jsx
# - UsersAdminPanel.jsx
# - TournamentsAdminPanel.jsx
# - FeatureFlagsPanel.jsx
# - AnalyticsAdminPanel.jsx
# - SecurityAdminPanel.jsx
# - SystemAdminPanel.jsx

# Y 1 archivo en config/:
# - featureFlags.js
```

**Reporta**: ✅ Si todos existen o ❌ si falta alguno

---

### 🔍 PASO 2: CORRECCIÓN DE IMPORTS

**Problema conocido**: `FeatureFlagsPanel.jsx` tiene un import incorrecto

**Archivo**: `src/components/admin/FeatureFlagsPanel.jsx`

**Líneas 3-4** (aproximadamente):
```javascript
// ❌ INCORRECTO:
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firestore';

// ✅ CORRECTO:
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
```

**Acción**:
1. Abre `src/components/admin/FeatureFlagsPanel.jsx`
2. Busca la línea con `from 'firestore'`
3. Cámbiala a `from 'firebase/firestore'`
4. Guarda el archivo

**Verifica también** los otros 7 archivos admin por imports similares incorrectos:
- Todos los imports de Firestore deben ser: `from 'firebase/firestore'`
- Todos los imports de Auth deben ser: `from 'firebase/auth'`

---

### 🧪 PASO 3: COMPILACIÓN Y TESTING

**Acción**: Compila el proyecto y verifica errores

```bash
# Inicia el servidor de desarrollo
npm run dev

# Abre en navegador:
# http://localhost:5173

# Revisa la consola del terminal
# NO debe haber errores de compilación
```

**Errores comunes a buscar**:
- ❌ `Module not found` → Revisa imports
- ❌ `Cannot find module 'firestore'` → Cambia a 'firebase/firestore'
- ❌ `Unexpected token` → Revisa sintaxis JSX
- ❌ Component definition errors → Verifica export default

**Si hay errores**:
1. Lee el mensaje completo
2. Identifica el archivo y línea
3. Corrige el error
4. Reinicia `npm run dev`

**Reporta**:
- ✅ "Compilación exitosa, sin errores"
- O ❌ "Error en [archivo]:[línea] - [mensaje]"

---

### 🔐 PASO 4: ASIGNAR ROL DE ADMINISTRADOR

Para acceder al dashboard, necesito un usuario con `role: "admin"`.

#### Opción A: Manual desde Firebase Console

1. Ve a https://console.firebase.google.com
2. Selecciona proyecto: `golfscorings-e4338`
3. Firestore Database
4. Colección `users`
5. Busca tu usuario por UID (o cualquier usuario para probar)
6. Edita el documento
7. Agrega/modifica campo:
   ```
   role: "admin"
   ```
8. Guarda

#### Opción B: Script Automático (RECOMENDADO)

**Crea el archivo**: `scripts/make-admin.js`

```javascript
#!/usr/bin/env node

/**
 * Script para asignar rol de admin a un usuario
 * Uso: node scripts/make-admin.js email@ejemplo.com
 */

const admin = require('firebase-admin');
const serviceAccount = require('../MIGRATION_CREDENTIALS.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function makeAdmin(email) {
  try {
    console.log(`🔍 Buscando usuario con email: ${email}`);

    // Buscar usuario por email en colección users
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (usersSnapshot.empty) {
      console.error('❌ No se encontró usuario con ese email');
      process.exit(1);
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`✅ Usuario encontrado: ${userData.username} (${userData.full_name})`);
    console.log(`📝 UID: ${userId}`);

    // Actualizar rol a admin
    await db.collection('users').doc(userId).update({
      role: 'admin',
      updated_at: new Date().toISOString()
    });

    console.log(`🎉 ¡Usuario ahora es ADMIN!`);
    console.log(`🔗 Accede al dashboard en: /admin`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar
const email = process.argv[2];

if (!email) {
  console.error('❌ Uso: node scripts/make-admin.js email@ejemplo.com');
  process.exit(1);
}

makeAdmin(email);
```

**Instalación de dependencia**:
```bash
npm install firebase-admin --save-dev
```

**Uso del script**:
```bash
# Asignar admin a un usuario por email
node scripts/make-admin.js nicole@golfteam.app

# O al email que estés usando
node scripts/make-admin.js TU_EMAIL@ejemplo.com
```

**Reporta**:
- ✅ "Usuario [email] es ahora admin"
- O ❌ "Error al asignar rol: [mensaje]"

---

### 🧭 PASO 5: ACCESO AL DASHBOARD

**Acción**: Accede al dashboard y verifica que funciona

1. **Con el servidor corriendo** (`npm run dev`)
2. **Inicia sesión** con el usuario que asignaste como admin
3. **Navega a**: `http://localhost:5173/admin`

**Comportamiento esperado**:

#### Si NO eres admin:
```
Pantalla muestra:
🚫 Acceso Denegado
No tienes permisos de administrador
[Botón: Volver al Inicio]
```

#### Si SÍ eres admin:
```
Pantalla muestra:
🛡️ Panel de Administración
Bienvenido, [Tu Nombre]

Pestañas:
- Usuarios
- Torneos
- Feature Flags
- Analytics
- Seguridad
- Sistema
```

**Reporta**:
- ✅ "Dashboard accesible, se ven todas las pestañas"
- ❌ "Error: [descripción del problema]"

---

### ✅ PASO 6: TESTING DE FUNCIONALIDADES

**Acción**: Prueba cada panel del dashboard

#### 6.1 Panel de USUARIOS

**Prueba**:
1. Clic en pestaña "Usuarios"
2. Debe mostrar tabla con usuarios existentes
3. Clic en botón "Crear Usuario"
4. Completa formulario:
   ```
   Username: test_user
   Email: test@roundtracker.app
   Password: Test123!
   Nombre: Usuario de Prueba
   Rol: Player
   ```
5. Clic en "Crear Usuario"

**Resultado esperado**:
- ✅ Mensaje: "Usuario 'test_user' creado correctamente"
- ✅ Usuario aparece en la tabla
- ✅ Puedes editarlo, resetear password, eliminarlo

**Reporta**: ✅ Funciona o ❌ Error: [mensaje]

---

#### 6.2 Panel de TORNEOS

**Prueba**:
1. Clic en pestaña "Torneos"
2. Debe mostrar torneos existentes
3. Clic en "Crear Torneo"
4. Completa:
   ```
   ID: 999
   Nombre: Torneo de Prueba
   Fechas: 01/04/2026
   Ubicación: Club de Golf Test
   Organización: Club
   Tipo: Stroke Play
   ```
5. Guardar

**Resultado esperado**:
- ✅ Torneo creado
- ✅ Aparece en la lista
- ✅ Botón "Exportar CSV" funciona

**Reporta**: ✅ Funciona o ❌ Error: [mensaje]

---

#### 6.3 Panel de FEATURE FLAGS

**Prueba**:
1. Clic en pestaña "Feature Flags"
2. Debe mostrar 12 features
3. Busca feature: `FRIENDS_SYSTEM`
4. Activa el toggle (debe cambiar a verde "ACTIVA")
5. Mueve el slider de Rollout a 50%

**Resultado esperado**:
- ✅ Toggle cambia de estado
- ✅ Rollout se actualiza
- ✅ Se puede filtrar por categorías

**Reporta**: ✅ Funciona o ❌ Error: [mensaje]

---

#### 6.4 Panel de ANALYTICS

**Prueba**:
1. Clic en pestaña "Analytics"
2. Debe mostrar 4 tarjetas con métricas:
   - Usuarios Totales
   - Torneos Oficiales
   - Resultados Guardados
   - Usuarios Activos

**Resultado esperado**:
- ✅ Números se muestran correctamente
- ✅ Botón "Actualizar Estadísticas" recarga datos

**Reporta**: ✅ Funciona o ❌ Error: [mensaje]

---

#### 6.5 Panel de SEGURIDAD

**Prueba**:
1. Clic en pestaña "Seguridad"
2. Debe mostrar reglas de Firestore
3. Clic en "Copiar Reglas"

**Resultado esperado**:
- ✅ Reglas copiadas al portapapeles
- ✅ Muestra banner de estado de seguridad
- ✅ Enlace a Firebase Console funciona

**Reporta**: ✅ Funciona o ❌ Error: [mensaje]

---

#### 6.6 Panel de SISTEMA

**Prueba**:
1. Clic en pestaña "Sistema"
2. Debe mostrar 3 utilidades
3. Clic en "Limpiar Caches"

**Resultado esperado**:
- ✅ Confirmación antes de ejecutar
- ✅ Logs aparecen en sección inferior
- ✅ Mensaje de éxito

**Reporta**: ✅ Funciona o ❌ Error: [mensaje]

---

### 🐛 PASO 7: REVISIÓN DE ERRORES EN CONSOLA

**Acción**: Abre DevTools del navegador

```
Chrome/Edge: F12 o Ctrl+Shift+I
Firefox: F12
Safari: Cmd+Option+I
```

**Verifica**:
1. Pestaña "Console" → NO debe haber errores rojos
2. Pestaña "Network" → Todas las requests deben ser 200 OK
3. Warnings amarillos son aceptables (React dev warnings)

**Errores comunes**:
- ❌ `Failed to fetch` → Problema de Firebase config
- ❌ `Permission denied` → Reglas de Firestore muy restrictivas
- ❌ `Cannot read property of undefined` → Problema de datos

**Reporta**:
- ✅ "Consola limpia, sin errores"
- ❌ "Errores en consola: [captura o descripción]"

---

## 📊 REPORTE FINAL

Una vez completados todos los pasos, crea un reporte con este formato:

```markdown
# Reporte de Implementación - Dashboard Admin RoundTracker

**Fecha**: [Fecha actual]
**Ejecutado por**: Codex
**Tiempo total**: [XX minutos]

## ✅ Tareas Completadas

- [ ] Paso 1: Verificación de archivos
- [ ] Paso 2: Corrección de imports
- [ ] Paso 3: Compilación exitosa
- [ ] Paso 4: Rol admin asignado
- [ ] Paso 5: Acceso al dashboard
- [ ] Paso 6: Testing de funcionalidades
  - [ ] Usuarios
  - [ ] Torneos
  - [ ] Feature Flags
  - [ ] Analytics
  - [ ] Seguridad
  - [ ] Sistema
- [ ] Paso 7: Consola sin errores

## 🐛 Errores Encontrados y Corregidos

1. **[Archivo]**: [Línea XX]
   - Error: [Descripción]
   - Solución: [Qué se hizo]

2. ...

## 🚀 Estado Final

- **Compilación**: ✅ Exitosa / ❌ Con errores
- **Dashboard accesible**: ✅ Sí / ❌ No
- **Funcionalidades probadas**: X/6
- **Errores en consola**: X errores

## 📝 Notas Adicionales

[Cualquier observación, mejora sugerida, o problema pendiente]

## 🔗 Acceso

- **URL local**: http://localhost:5173/admin
- **Usuario admin**: [email del usuario admin]
- **Contraseña**: [si la configuraste]

## 🎯 Próximos Pasos Recomendados

1. [Sugerencia 1]
2. [Sugerencia 2]
3. ...
```

---

## 📚 ARCHIVOS DE REFERENCIA

Si necesitas más contexto, lee estos archivos en orden:

1. **ADMIN_DASHBOARD.md** - Documentación completa del dashboard (casos de uso, guías)
2. **BRANDING.md** - Identidad de marca (colores, eslogan, tono)
3. **REBRANDING_CHANGELOG.md** - Cambios recientes (nombre RoundTracker)
4. **src/firebase.js** - Configuración de Firebase
5. **src/App.jsx** - Estructura de rutas y autenticación
6. **src/utils/userProfiles.js** - Utilidades para perfiles de usuario

---

## ⚠️ RESTRICCIONES IMPORTANTES

### ❌ NO HAGAS ESTO:
- No modifiques la estructura de carpetas
- No cambies nombres de archivos existentes
- No agregues nuevas dependencias npm (usa solo las instaladas)
- No modifiques `src/App.jsx` (excepto si es crítico)
- No cambies la lógica de autenticación
- No toques configuración de Firebase (`src/firebase.js`)
- No modifiques reglas de Firestore directamente

### ✅ SÍ PUEDES:
- Corregir imports
- Arreglar bugs de sintaxis
- Mejorar manejo de errores
- Agregar loading states
- Mejorar mensajes de usuario
- Optimizar queries de Firestore
- Agregar validaciones
- Mejorar estilos CSS inline

---

## 🆘 SI ALGO NO FUNCIONA

### Error: "Cannot find module"
**Causa**: Import incorrecto
**Solución**: Verifica la ruta del import

### Error: "Permission denied"
**Causa**: Reglas de Firestore muy restrictivas
**Solución**: Temporal - usa reglas permisivas en desarrollo:
```javascript
// firestore.rules (SOLO DESARROLLO)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Error: "User is not admin"
**Causa**: Campo `role` no está configurado
**Solución**: Ejecuta el script `make-admin.js` o configura manualmente en Firebase Console

### Error de compilación persistente
**Solución**:
```bash
# Limpia cache y reinstala
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 🎯 CRITERIOS DE ÉXITO

El dashboard está **100% funcional** si:

✅ La app compila sin errores
✅ Se puede acceder a `/admin`
✅ Se muestran las 6 pestañas
✅ Se puede crear un usuario
✅ Se puede crear un torneo
✅ Se pueden activar/desactivar feature flags
✅ Analytics muestra métricas
✅ No hay errores en consola del navegador
✅ El usuario admin puede usar todas las funcionalidades

---

## 📞 CONTACTO

Si encuentras un problema que no puedes resolver, documéntalo con:
- Mensaje de error completo
- Archivo y línea donde ocurre
- Captura de pantalla si es visual
- Pasos para reproducirlo

---

## ⏱️ TIEMPO ESTIMADO POR PASO

- Paso 1 (Verificación): 2 min
- Paso 2 (Correcciones): 10 min
- Paso 3 (Compilación): 5 min
- Paso 4 (Rol admin): 5 min
- Paso 5 (Acceso): 2 min
- Paso 6 (Testing): 20 min
- Paso 7 (Consola): 5 min
- Reporte final: 10 min

**TOTAL**: ~60 minutos

---

## 🎉 ¡ÉXITO!

Cuando todo funcione, habrás implementado un dashboard de administración profesional que permite:

✨ Gestionar usuarios sin Firebase Console
✨ Crear torneos sin tocar código
✨ Controlar features con Feature Flags
✨ Ver métricas en tiempo real
✨ Configurar seguridad visualmente
✨ Ejecutar utilidades del sistema

**¡Manos a la obra!** 🚀

---

**Archivo creado**: 22 de marzo de 2026
**Mantenido por**: Reinaldo Moon
**Versión**: 1.0

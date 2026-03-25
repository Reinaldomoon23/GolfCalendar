# Guía de Setup - Entorno Staging

**Objetivo**: Crear entorno de staging completamente separado de producción
**Fecha**: 17 de marzo de 2026
**Tiempo estimado**: 2-3 horas

---

## 🎯 ¿Por Qué Staging?

```
❌ SIN STAGING (Situación actual)
┌──────────────────────────────┐
│    Desarrollo Local          │
│    (localhost:5173)          │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│    PRODUCCIÓN                │  ⚠️ PELIGRO: Testing directo
│    (usuarios reales)         │     en producción
└──────────────────────────────┘


✅ CON STAGING (Objetivo)
┌──────────────────────────────┐
│    Desarrollo Local          │
│    (localhost:5173)          │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│    STAGING                   │  ✅ Testing seguro
│    (stage.golf-tracker.app)  │     Sin afectar usuarios
└──────────────┬───────────────┘
               │
               ▼ (Solo si todo OK)
┌──────────────────────────────┐
│    PRODUCCIÓN                │
│    (usuarios reales)         │
└──────────────────────────────┘
```

---

## 📋 Checklist Completo

### Paso 1: Firebase
- [ ] 1.1 Crear proyecto `golf-tracker-stage`
- [ ] 1.2 Habilitar Authentication (Email/Password)
- [ ] 1.3 Crear base de datos Firestore
- [ ] 1.4 Configurar reglas de seguridad (permisivas para testing)
- [ ] 1.5 Obtener credenciales del proyecto
- [ ] 1.6 Migrar datos de prueba

### Paso 2: Código
- [ ] 2.1 Crear archivo `.env.stage`
- [ ] 2.2 Actualizar `firebase.js` para multi-entorno
- [ ] 2.3 Crear script de build para staging
- [ ] 2.4 Probar build local

### Paso 3: Hosting
- [ ] 3.1 Configurar Vercel/Netlify para staging
- [ ] 3.2 Conectar con repositorio GitHub
- [ ] 3.3 Deploy manual inicial
- [ ] 3.4 Verificar URL de staging

### Paso 4: Validación
- [ ] 4.1 Smoke test (login básico)
- [ ] 4.2 Verificar que NO toca producción
- [ ] 4.3 Crear usuarios de prueba en staging

---

## 🔥 PASO 1: Configurar Firebase Staging

### 1.1 Crear Proyecto en Firebase Console

**Acciones**:
1. Ir a https://console.firebase.google.com/
2. Hacer clic en "Agregar proyecto"
3. Nombre del proyecto: `golf-tracker-stage`
4. Deshabilitar Google Analytics (opcional para staging)
5. Hacer clic en "Crear proyecto"

**Resultado esperado**:
```
✅ Proyecto creado: golf-tracker-stage
✅ URL del proyecto: https://console.firebase.google.com/u/0/project/golf-tracker-stage
```

---

### 1.2 Habilitar Authentication

**Acciones**:
1. En Firebase Console de `golf-tracker-stage`
2. Ir a "Authentication" en el menú lateral
3. Hacer clic en "Comenzar"
4. En la pestaña "Sign-in method"
5. Habilitar "Email/Password"
6. **NO** habilitar "Email link (passwordless sign-in)"
7. Guardar

**Resultado esperado**:
```
✅ Email/Password habilitado
✅ Estado: Enabled
```

**Screenshot de referencia**:
```
Sign-in providers
┌─────────────────────────────────────────┐
│ Email/Password              [Enabled ✓] │
│ Google                      [Disabled]   │
│ Facebook                    [Disabled]   │
└─────────────────────────────────────────┘
```

---

### 1.3 Crear Base de Datos Firestore

**Acciones**:
1. Ir a "Firestore Database" en el menú
2. Hacer clic en "Crear base de datos"
3. Seleccionar modo: **"Comenzar en modo de prueba"**
   - ⚠️ Solo para staging, cambiaremos reglas después
4. Ubicación: `europe-west` (o la más cercana)
5. Hacer clic en "Habilitar"

**Resultado esperado**:
```
✅ Base de datos creada
✅ Modo: Test (reglas permisivas temporalmente)
✅ Ubicación: europe-west
```

**Reglas iniciales** (temporal):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TEMPORAL: Permitir todo para setup inicial
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2026, 4, 1);
    }
  }
}
```

---

### 1.4 Obtener Credenciales del Proyecto

**Acciones**:
1. Ir a "Configuración del proyecto" (icono de engranaje)
2. Scroll down hasta "Tus apps"
3. Hacer clic en "Web" (icono </>)
4. Nombre de la app: `Golf Tracker Staging`
5. **NO** marcar "Configurar Firebase Hosting"
6. Hacer clic en "Registrar app"
7. **Copiar** el objeto `firebaseConfig`

**Ejemplo de credenciales**:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "golf-tracker-stage.firebaseapp.com",
  projectId: "golf-tracker-stage",
  storageBucket: "golf-tracker-stage.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

**Guardar estas credenciales** - Las necesitaremos en el Paso 2.

---

### 1.5 Migrar Datos de Prueba a Staging

**Opción A: Crear usuarios manualmente en Firebase Console**

1. Ir a Authentication → Users
2. Hacer clic en "Agregar usuario"
3. Crear usuarios de prueba:

```
Usuario 1 (Test Nicole):
Email: nicole.stage@golfteam.app
Password: StageTest123!
UID: (se genera automáticamente)

Usuario 2 (Test David):
Email: david.stage@golfteam.app
Password: StageTest123!
UID: (se genera automáticamente)

Usuario 3 (Test Txell):
Email: txell.stage@golfteam.app
Password: StageTest123!
UID: (se genera automáticamente)
```

**Opción B: Usar script de migración** (Recomendado)

Crear archivo: `scripts/setup_stage_users.js`

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Credenciales de STAGING (del paso 1.4)
const stageConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "golf-tracker-stage.firebaseapp.com",
  projectId: "golf-tracker-stage",
  storageBucket: "golf-tracker-stage.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};

const app = initializeApp(stageConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const testUsers = [
  {
    email: 'nicole.stage@golfteam.app',
    password: 'StageTest123!',
    username: 'nicole_stage',
    full_name: 'Nicole Stage Test',
    federation_id: null // Sin licencia para testing
  },
  {
    email: 'david.stage@golfteam.app',
    password: 'StageTest123!',
    username: 'david_stage',
    full_name: 'David Stage Test',
    managed_users: ['maria_stage', 'sofia_stage']
  },
  {
    email: 'maria.stage@golfteam.app',
    password: 'StageTest123!',
    username: 'maria_stage',
    full_name: 'Maria Stage Test'
  },
  {
    email: 'sofia.stage@golfteam.app',
    password: 'StageTest123!',
    username: 'sofia_stage',
    full_name: 'Sofia Stage Test'
  },
  {
    email: 'txell.stage@golfteam.app',
    password: 'StageTest123!',
    username: 'txell_stage',
    full_name: 'Txell Stage Test'
  }
];

async function createStageUsers() {
  console.log('🚀 Creando usuarios de staging...\n');

  for (const user of testUsers) {
    try {
      // 1. Crear en Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        user.email,
        user.password
      );

      const uid = userCredential.user.uid;
      console.log(`✅ Usuario creado en Auth: ${user.email} (${uid})`);

      // 2. Crear documento en Firestore users/{uid}
      await setDoc(doc(db, 'users', uid), {
        username: user.username,
        uid: uid,
        email: user.email,
        full_name: user.full_name,
        federation_id: user.federation_id || null,
        managed_users: user.managed_users || [],
        photo_url: null,
        current_handicap: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log(`✅ Documento Firestore creado: users/${uid}`);

      // 3. Crear mapping username -> uid
      await setDoc(doc(db, 'usernames', user.username), {
        uid: uid,
        username: user.username,
        updated_at: new Date().toISOString()
      });

      console.log(`✅ Mapping creado: usernames/${user.username}`);
      console.log('');

    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`⚠️  Usuario ya existe: ${user.email}`);
      } else {
        console.error(`❌ Error creando ${user.email}:`, error.code, error.message);
      }
      console.log('');
    }
  }

  console.log('✅ Todos los usuarios de staging creados!\n');
  console.log('Credenciales para testing:');
  testUsers.forEach(u => {
    console.log(`  - ${u.email} / ${u.password}`);
  });
}

createStageUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
```

**Ejecutar script**:
```bash
node scripts/setup_stage_users.js
```

**Resultado esperado**:
```
✅ 5 usuarios creados en Staging
✅ Documentos Firestore creados
✅ Mappings creados
```

---

## 💻 PASO 2: Configurar Código para Multi-Entorno

### 2.1 Crear Archivo `.env.stage`

**Ubicación**: Raíz del proyecto

**Contenido**:
```bash
# Entorno
VITE_ENVIRONMENT=staging

# Firebase Staging (usar credenciales del paso 1.4)
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=golf-tracker-stage.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=golf-tracker-stage
VITE_FIREBASE_STORAGE_BUCKET=golf-tracker-stage.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# App Config
VITE_APP_MODE=multi
VITE_BASE_URL=/

# Feature Flags
VITE_ENABLE_ALL_FEATURES=true

# Cloudflare R2 (mismas credenciales que producción)
# Puedes usar el mismo bucket o crear uno separado para staging
```

**Agregar a `.gitignore`**:
```bash
# Variables de entorno
.env.local
.env.stage
.env.production
.env*.local
```

---

### 2.2 Actualizar `src/firebase.js` para Multi-Entorno

**Archivo**: `src/firebase.js`

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Detectar entorno
const environment = import.meta.env.VITE_ENVIRONMENT || 'development';

console.log(`🔥 Firebase: Inicializando en entorno ${environment}`);

// Configuración según entorno
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validar configuración
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase config incompleta. Verifica variables de entorno.');
  throw new Error('Firebase configuration missing');
}

console.log(`📦 Conectando a proyecto: ${firebaseConfig.projectId}`);

// Inicializar Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Emuladores (solo en desarrollo local)
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  console.log('🔌 Conectando a emuladores Firebase...');
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
}

// Log del entorno activo
console.log(`✅ Firebase inicializado correctamente`);
console.log(`   Entorno: ${environment}`);
console.log(`   Proyecto: ${firebaseConfig.projectId}`);
```

---

### 2.3 Crear Script de Build para Staging

**Archivo**: `package.json`

Agregar scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:stage": "vite build --mode staging",
    "build:prod": "vite build --mode production",
    "preview": "vite preview",
    "preview:stage": "vite preview --mode staging"
  }
}
```

---

### 2.4 Crear Archivo de Configuración Vite para Staging

**Archivo**: `vite.config.js`

Actualizar:

```javascript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Cargar variables de entorno según modo
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // ... resto de config PWA
      })
    ],
    base: env.VITE_BASE_URL || '/',
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_ENVIRONMENT)
    }
  };
});
```

---

### 2.5 Probar Build Local para Staging

```bash
# Build para staging
npm run build:stage

# Preview local
npm run preview:stage
```

**Verificar**:
1. Abrir http://localhost:4173
2. Abrir DevTools → Console
3. Buscar logs de Firebase
4. Verificar que dice `Proyecto: golf-tracker-stage`

---

## 🌐 PASO 3: Configurar Hosting (Vercel)

### 3.1 Instalar Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Login en Vercel

```bash
vercel login
```

### 3.3 Crear Proyecto de Staging en Vercel

```bash
# Desde la raíz del proyecto
vercel --name golf-tracker-stage

# Responder preguntas:
# - Set up and deploy? Yes
# - Which scope? [tu cuenta]
# - Link to existing project? No
# - Project name? golf-tracker-stage
# - In which directory is your code? ./
# - Want to override settings? Yes
#   - Build Command: npm run build:stage
#   - Output Directory: dist
#   - Development Command: npm run dev
```

### 3.4 Configurar Variables de Entorno en Vercel

**Opción A: Via CLI**

```bash
vercel env add VITE_ENVIRONMENT
# Ingresar: staging

vercel env add VITE_FIREBASE_API_KEY
# Ingresar: [tu API key de staging]

# Repetir para todas las variables de .env.stage
```

**Opción B: Via Dashboard** (Más fácil)

1. Ir a https://vercel.com/dashboard
2. Seleccionar proyecto `golf-tracker-stage`
3. Ir a Settings → Environment Variables
4. Agregar todas las variables de `.env.stage`
5. Asegurarse de seleccionar entornos: **Production, Preview, Development**

Variables a agregar:
```
VITE_ENVIRONMENT=staging
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=golf-tracker-stage
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_APP_MODE=multi
VITE_BASE_URL=/
VITE_ENABLE_ALL_FEATURES=true
```

### 3.5 Deploy Inicial a Staging

```bash
vercel --prod
```

**Resultado esperado**:
```
✅ Deploy exitoso
✅ URL: https://golf-tracker-stage.vercel.app
   (o dominio personalizado si configuraste)
```

---

## ✅ PASO 4: Validación de Staging

### 4.1 Smoke Test Básico

**Acciones**:
1. Abrir URL de staging: `https://golf-tracker-stage.vercel.app`
2. Verificar que carga la app
3. Intentar login con: `nicole.stage@golfteam.app` / `StageTest123!`
4. Verificar que login funciona

**Resultado esperado**:
```
✅ App carga correctamente
✅ Login exitoso
✅ No hay errores en consola
✅ Firebase conecta a proyecto STAGING (verificar en DevTools)
```

---

### 4.2 Verificar que NO Toca Producción

**Acciones**:
1. En DevTools → Console, buscar logs de Firebase
2. Verificar que dice: `Proyecto: golf-tracker-stage`
3. Ir a Firebase Console de PRODUCCIÓN
4. Ver Authentication → Users
5. Verificar que NO aparecen usuarios `*.stage@golfteam.app`

**Resultado esperado**:
```
✅ Staging usa base de datos separada
✅ NO afecta a producción
✅ Usuarios de staging solo en staging
```

---

### 4.3 Test Rápido de Funcionalidad Básica

**Checklist mínimo**:
```
[ ] Login funciona
[ ] Perfil se carga
[ ] Puede crear un resultado de prueba
[ ] Puede crear un torneo personalizado
[ ] Logout funciona
[ ] Re-login funciona
```

---

## 📊 Resumen Final

### URLs de los Entornos

```
🟢 STAGING:  https://golf-tracker-stage.vercel.app
🔴 PRODUCCIÓN: https://reinaldomoon.top/GolfTeam/
```

### Usuarios de Testing en Staging

```
nicole.stage@golfteam.app / StageTest123!
david.stage@golfteam.app / StageTest123!
maria.stage@golfteam.app / StageTest123!
sofia.stage@golfteam.app / StageTest123!
txell.stage@golfteam.app / StageTest123!
```

### Proyectos Firebase

```
🟢 Staging: golf-tracker-stage
🔴 Producción: golf-tracker-prod
```

---

## 🎉 ¡Staging Listo!

Ahora puedes:
1. ✅ Hacer testing funcional en staging SIN riesgo
2. ✅ Probar cambios antes de producción
3. ✅ Validar nuevas features
4. ✅ Hacer pruebas destructivas (eliminar datos, etc.)

### Próximo Paso

Volver a **[TEST_MANUAL_FUNCIONAL.md](./TEST_MANUAL_FUNCIONAL.md)** pero ahora ejecutar los tests en:
- **URL**: https://golf-tracker-stage.vercel.app
- **Usuarios**: nicole.stage@golfteam.app, etc.

---

**Última actualización**: 17 de marzo de 2026
**Mantenido por**: Reinaldo Moon

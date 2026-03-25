# Configuración de Entorno Staging

**Fecha**: 24 de marzo de 2026
**Prioridad**: 🟡 ALTA
**Tiempo estimado**: 1-2 horas

---

## 🎯 Objetivo

Crear un entorno Staging separado de Producción para:
- ✅ Probar cambios antes de deploy a producción
- ✅ Evitar romper la app en producción
- ✅ Permitir testing con datos reales sin afectar usuarios
- ✅ Desarrollo más seguro y profesional

---

## 🏗️ Arquitectura de Entornos

```
┌─────────────────────────────────────────────────────────────────┐
│ ANTES (Riesgoso)                                                │
│                                                                 │
│   Development Local  ──────┐                                   │
│   (npm run dev)            │                                   │
│                            ├──> Production                      │
│   Cambios en código ───────┘    (Hostinger/Vercel)             │
│                                 ⚠️ Deploy directo sin testing   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DESPUÉS (Seguro)                                                │
│                                                                 │
│   Development Local  ────> Staging ────> Production            │
│   (npm run dev)           (Vercel)      (Hostinger/Vercel)     │
│                              │                                  │
│                              ├─ Testing                         │
│                              ├─ QA                              │
│                              └─ Aprobación ✅                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Plan de Implementación

### Opción A: Firebase + Vercel (RECOMENDADO) ⚡
- **Pros**: Gratis, rápido, fácil, CD automático con Git
- **Cons**: Necesitas cuenta Vercel
- **Tiempo**: 30-60 min

### Opción B: Firebase + Hostinger Subdomain
- **Pros**: Todo en Hostinger
- **Cons**: Más manual, necesitas configurar CI/CD
- **Tiempo**: 1-2 horas

---

## 🚀 OPCIÓN A: Firebase + Vercel (RECOMENDADO)

### Paso 1: Crear Proyecto Firebase Staging

#### 1.1 Firebase Console
1. Ve a https://console.firebase.google.com/
2. Click "Add Project"
3. Nombre: `golf-tracker-stage`
4. Deshabilitar Google Analytics (opcional para stage)
5. Click "Create Project"

#### 1.2 Habilitar Authentication
1. En el nuevo proyecto, ve a **Authentication**
2. Click "Get Started"
3. Enable "Email/Password"

#### 1.3 Habilitar Firestore
1. Ve a **Firestore Database**
2. Click "Create Database"
3. Selecciona modo "Production" (con reglas restrictivas)
4. Región: `europe-west3` (o la que prefieras)

#### 1.4 Copiar Configuración
1. Ve a **Project Settings** (⚙️)
2. Scroll down → "Your apps"
3. Click </> (Web app)
4. Nombre: `golf-tracker-stage-web`
5. Register app
6. Copia el `firebaseConfig` object

### Paso 2: Configurar Variables de Entorno Staging

Crear archivo `.env.staging`:

```bash
# .env.staging

# Firebase Staging Config
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=golf-tracker-stage.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=golf-tracker-stage
VITE_FIREBASE_STORAGE_BUCKET=golf-tracker-stage.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Cloudflare R2 (usar mismas credenciales o crear bucket stage)
VITE_CLOUDFLARE_ACCOUNT_ID=tu_account_id
VITE_CLOUDFLARE_ACCESS_KEY_ID=tu_access_key
VITE_CLOUDFLARE_SECRET_ACCESS_KEY=tu_secret_key
VITE_CLOUDFLARE_BUCKET_NAME=golf-tracker-photos-stage

# Sentry (opcional, crear proyecto separado o usar mismo)
VITE_SENTRY_DSN=https://XXXXXXXX@sentry.io/XXXXXXXX

# Environment identifier
VITE_ENV=staging
```

### Paso 3: Actualizar firebase.js para Múltiples Entornos

Editar `src/firebase.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Get config from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate config
if (!firebaseConfig.apiKey) {
    throw new Error('Firebase config not found. Check environment variables.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Log environment (only in development)
if (import.meta.env.DEV) {
    console.log('Firebase initialized:', {
        projectId: firebaseConfig.projectId,
        env: import.meta.env.MODE
    });
}

export default app;
```

### Paso 4: Desplegar Firestore Rules a Staging

Actualizar `.firebaserc`:

```json
{
  "projects": {
    "default": "golfscoring-a9a6c",
    "staging": "golf-tracker-stage",
    "production": "golfscoring-a9a6c"
  }
}
```

Desplegar reglas a Staging:

```bash
# Cambiar a proyecto staging
firebase use staging

# Desplegar reglas
firebase deploy --only firestore:rules

# Volver a producción
firebase use default
```

### Paso 5: Configurar Vercel

#### 5.1 Crear Cuenta Vercel
1. Ve a https://vercel.com/signup
2. Sign up con GitHub (recomendado)

#### 5.2 Importar Proyecto
1. Click "Add New Project"
2. Import Git Repository
3. Selecciona tu repo `Players Calendar`
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

#### 5.3 Configurar Environment Variables en Vercel
1. En Vercel → Project Settings → Environment Variables
2. Agregar TODAS las variables de `.env.staging`
3. Seleccionar **Production** + **Preview** environments

#### 5.4 Deploy
1. Click "Deploy"
2. Espera 2-3 minutos
3. Obtendrás URL: `https://golf-tracker-XXXX.vercel.app`

#### 5.5 Custom Domain (Opcional)
1. Settings → Domains
2. Agregar: `stage.golftracker.com`
3. Configurar DNS en tu proveedor

---

## 🔄 Workflow de Desarrollo

### Development → Staging → Production

```bash
# 1. Desarrollo local
npm run dev

# 2. Hacer cambios
# ... editar código ...

# 3. Commit a Git
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main

# 4. Vercel auto-deploy a Staging
# (automático cuando haces push)

# 5. Testing en Staging
# → Abrir https://golf-tracker-XXXX.vercel.app
# → Hacer testing manual
# → Verificar que todo funciona

# 6. Si todo OK → Deploy a Production
# → Manual: Build y deploy a Hostinger
# → O configurar Vercel para production también
```

---

## 🧪 Testing en Staging

### Checklist de Testing
- [ ] Login funciona
- [ ] Ver torneos funciona
- [ ] Crear torneo personalizado
- [ ] Registrar resultado
- [ ] Modo live funciona
- [ ] Manager mode funciona
- [ ] Hándicap se actualiza
- [ ] Fotos de perfil funcionan
- [ ] No hay errores en consola
- [ ] Performance es buena

---

## 📊 Monitoreo de Staging

### Sentry (Opcional)
Crear proyecto separado:
1. Sentry → Create Project
2. Nombre: `golf-tracker-stage`
3. Copiar DSN
4. Agregar a `.env.staging`

### Firebase Console
Monitorear:
- **Authentication** → Users creados en stage
- **Firestore** → Documentos de test
- **Usage** → Reads/Writes

---

## 🚨 Importante: Datos de Test

### Crear Usuarios de Test
```
Email: test-admin@golftracker.com
Password: TestStaging123!

Email: test-player@golftracker.com
Password: TestStaging123!
```

### Separar Datos de Producción
⚠️ **NUNCA usar datos reales en Staging**

En Staging:
- Solo usuarios de test
- Torneos de prueba
- Resultados ficticios

---

## 📝 Scripts NPM

Agregar a `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:staging": "vite build --mode staging",
    "build:production": "vite build --mode production",
    "preview": "vite preview",
    "deploy:staging": "npm run build:staging && echo 'Deploy to Vercel via Git push'",
    "deploy:production": "npm run build:production && echo 'Deploy to Hostinger'"
  }
}
```

---

## 🔒 Seguridad en Staging

### Firestore Rules
Usar **las mismas reglas** que producción:

```bash
firebase use staging
firebase deploy --only firestore:rules
```

### Proteger con Password (Opcional)
En Vercel:
1. Settings → Password Protection
2. Enable
3. Set password: `TestStaging2026!`

---

## ✅ Checklist de Implementación

### Firebase
- [ ] Crear proyecto `golf-tracker-stage`
- [ ] Habilitar Authentication
- [ ] Habilitar Firestore
- [ ] Copiar firebaseConfig
- [ ] Desplegar Firestore Rules

### Código
- [ ] Crear `.env.staging`
- [ ] Actualizar `src/firebase.js` para usar env vars
- [ ] Actualizar `.firebaserc` con staging project
- [ ] Agregar scripts a `package.json`

### Vercel
- [ ] Crear cuenta Vercel
- [ ] Importar proyecto
- [ ] Configurar environment variables
- [ ] Deploy inicial
- [ ] Verificar que funciona

### Testing
- [ ] Crear usuarios de test
- [ ] Hacer testing completo
- [ ] Verificar no hay errores

---

## 📚 Documentos Relacionados

- [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) - Estado del proyecto
- [PLAN_MAESTRO.md](PLAN_MAESTRO.md) - Plan general
- [SETUP_SENTRY.md](SETUP_SENTRY.md) - Configuración de Sentry

---

**Última actualización**: 24 de marzo de 2026
**Autor**: Reinaldo Moon + Claude

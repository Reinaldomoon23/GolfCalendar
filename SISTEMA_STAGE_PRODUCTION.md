# Sistema Stage/Production con Feature Flags

**Objetivo**: Implementar entorno de staging y sistema de feature flags para desarrollo seguro
**Fecha**: 17 de marzo de 2026

---

## 📋 Índice

1. [Arquitectura de Entornos](#1-arquitectura-de-entornos)
2. [Sistema de Feature Flags](#2-sistema-de-feature-flags)
3. [Workflow de Desarrollo](#3-workflow-de-desarrollo)
4. [Configuración Firebase](#4-configuración-firebase)
5. [Deploy Automático](#5-deploy-automático)
6. [Testing en Stage](#6-testing-en-stage)

---

## 1. Arquitectura de Entornos

### 1.1 Entornos Propuestos

```
┌─────────────────────────────────────────────────────┐
│                   LOCAL (Dev)                        │
│  URL: http://localhost:5173                         │
│  Firebase: golf-tracker-dev                         │
│  Base de datos: Firestore Emulator (opcional)       │
│  Uso: Desarrollo diario                             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│                 STAGE (Staging)                      │
│  URL: https://stage.golf-tracker.app                │
│  Firebase: golf-tracker-stage                       │
│  Base de datos: Firestore Stage                     │
│  Uso: Testing de nuevas features                    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              PRODUCTION (Producción)                 │
│  URL: https://reinaldomoon.top/GolfTeam/            │
│  Firebase: golf-tracker-prod                        │
│  Base de datos: Firestore Production                │
│  Uso: Usuarios reales                               │
└─────────────────────────────────────────────────────┘
```

### 1.2 Proyectos Firebase

**Crear 3 proyectos en Firebase Console**:

1. **golf-tracker-dev** (Local/Dev)
2. **golf-tracker-stage** (Staging)
3. **golf-tracker-prod** (Producción - ACTUAL)

### 1.3 Variables de Entorno por Entorno

**Archivo**: `.env.local` (Local)
```bash
VITE_APP_MODE=multi
VITE_BASE_URL=/
VITE_ENVIRONMENT=development
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_PROJECT_ID=golf-tracker-dev
VITE_FIREBASE_AUTH_DOMAIN=golf-tracker-dev.firebaseapp.com
VITE_USE_EMULATORS=false
VITE_ENABLE_ALL_FEATURES=true  # Todas las features habilitadas
```

**Archivo**: `.env.stage`
```bash
VITE_APP_MODE=multi
VITE_BASE_URL=/
VITE_ENVIRONMENT=staging
VITE_FIREBASE_API_KEY=AIzaSyYYYYYYYYYYYYYYYYYYYYYY
VITE_FIREBASE_PROJECT_ID=golf-tracker-stage
VITE_FIREBASE_AUTH_DOMAIN=golf-tracker-stage.firebaseapp.com
VITE_USE_EMULATORS=false
VITE_ENABLE_ALL_FEATURES=true  # Todas las features habilitadas
```

**Archivo**: `.env.production`
```bash
VITE_APP_MODE=multi
VITE_BASE_URL=/GolfTeam/
VITE_ENVIRONMENT=production
VITE_FIREBASE_API_KEY=AIzaSyZZZZZZZZZZZZZZZZZZZZZZ
VITE_FIREBASE_PROJECT_ID=golf-tracker-prod
VITE_FIREBASE_AUTH_DOMAIN=golf-tracker-prod.firebaseapp.com
VITE_USE_EMULATORS=false
VITE_ENABLE_ALL_FEATURES=false  # Solo features estables
```

---

## 2. Sistema de Feature Flags

### 2.1 Configuración de Feature Flags

**Archivo**: `src/config/featureFlags.js`

```javascript
/**
 * Sistema de Feature Flags
 *
 * Permite activar/desactivar funcionalidades sin deploy
 * Cada feature tiene un código único y configuración por entorno
 */

const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'development';
const ENABLE_ALL = import.meta.env.VITE_ENABLE_ALL_FEATURES === 'true';

/**
 * Definición de Features
 *
 * Sistema de códigos exclusivos:
 * Formato: GT-[CATEGORIA]-[SUBCATEGORIA]-[NUMERO]
 *
 * GT: Golf Tracker
 * CATEGORIA: Área funcional (2-3 letras)
 * SUBCATEGORIA: Módulo específico (2-3 letras)
 * NUMERO: Secuencial de 3 dígitos (001-999)
 *
 * Ver documentación completa en: CODIGOS_FEATURES.md
 */

export const FEATURES = {
  // ========================================
  // SOCIAL FEATURES
  // ========================================

  // GT-SOC-FRI-001: Sistema base de amigos
  FRIENDS_SYSTEM: {
    code: 'GT-SOC-FRI-001',
    name: 'Sistema de Amigos',
    description: 'Permite agregar amigos, enviar solicitudes y ver perfiles',
    enabled: {
      development: true,
      staging: true,
      production: false  // Desactivado en producción hasta validar
    },
    dependencies: [], // No depende de otras features
    version: '1.0.0',
    releaseDate: '2026-04-01'
  },

  // GT-SOC-SHR-001: Compartir torneos con amigos
  SHARE_TOURNAMENTS: {
    code: 'GT-SOC-SHR-001',
    name: 'Compartir Torneos',
    description: 'Permite compartir torneos personalizados con amigos',
    enabled: {
      development: true,
      staging: true,
      production: false
    },
    dependencies: ['GT-SOC-FRI-001'], // Requiere sistema de amigos
    version: '1.0.0',
    releaseDate: '2026-04-15'
  },

  // GT-STT-CMP-001: Comparación de estadísticas
  COMPARE_STATS: {
    code: 'GT-STT-CMP-001',
    name: 'Comparar Estadísticas',
    description: 'Comparar estadísticas con amigos (gráficos, head-to-head)',
    enabled: {
      development: true,
      staging: true,
      production: false
    },
    dependencies: ['GT-SOC-FRI-001', 'GT-STT-BAS-001'],
    version: '1.0.0',
    releaseDate: '2026-05-01'
  },

  // ========================================
  // LIVE FEATURES
  // ========================================

  // GT-LIV-SHR-002: Suma de vueltas (YA IMPLEMENTADO)
  CUMULATIVE_ROUNDS: {
    code: 'GT-LIV-SHR-002',
    name: 'Suma de Vueltas',
    description: 'Mostrar total acumulado en tarjeta live de 2+ vueltas',
    enabled: {
      development: true,
      staging: true,
      production: true  // ✅ Ya validado y en producción
    },
    dependencies: [],
    version: '1.0.0',
    releaseDate: '2026-03-17'
  },

  // GT-LIV-SHR-005: Notificaciones push de vueltas
  LIVE_PUSH_NOTIFICATIONS: {
    code: 'GT-LIV-SHR-005',
    name: 'Notificaciones Push Live',
    description: 'Notificar a seguidores cuando se actualiza scorecard',
    enabled: {
      development: false,
      staging: false,
      production: false
    },
    dependencies: [],
    version: '1.0.0',
    releaseDate: 'TBD'
  },

  // ========================================
  // STATS FEATURES
  // ========================================

  // GT-STT-ADV-001: Estadísticas avanzadas
  ADVANCED_STATS: {
    code: 'GT-STT-ADV-001',
    name: 'Estadísticas Avanzadas',
    description: 'Análisis detallado: strokes gained, scrambling, etc.',
    enabled: {
      development: false,
      staging: false,
      production: false
    },
    dependencies: [],
    version: '1.0.0',
    releaseDate: 'TBD'
  },

  // ========================================
  // UI IMPROVEMENTS
  // ========================================

  // GT-UI-THM-001: Modo oscuro
  DARK_MODE: {
    code: 'GT-UI-THM-001',
    name: 'Modo Oscuro',
    description: 'Tema oscuro para la aplicación',
    enabled: {
      development: true,
      staging: false,
      production: false
    },
    dependencies: [],
    version: '1.0.0',
    releaseDate: 'TBD'
  },

  // GT-RST-SCR-006: Editor de scorecard mejorado
  ENHANCED_SCORECARD_EDITOR: {
    code: 'GT-RST-SCR-006',
    name: 'Editor Scorecard Mejorado',
    description: 'Nuevo editor con swipe, autocompletar, etc.',
    enabled: {
      development: false,
      staging: false,
      production: false
    },
    dependencies: [],
    version: '1.0.0',
    releaseDate: 'TBD'
  }
};

/**
 * Verificar si una feature está habilitada
 *
 * @param {string} featureKey - Clave de la feature (ej: 'FRIENDS_SYSTEM')
 * @returns {boolean}
 */
export function isFeatureEnabled(featureKey) {
  // Si ENABLE_ALL está activo (dev), habilitar todas
  if (ENABLE_ALL) return true;

  const feature = FEATURES[featureKey];
  if (!feature) {
    console.warn(`Feature ${featureKey} no encontrada`);
    return false;
  }

  // Verificar si está habilitada en el entorno actual
  const enabled = feature.enabled[ENVIRONMENT];

  // Verificar dependencias
  if (enabled && feature.dependencies.length > 0) {
    for (const depCode of feature.dependencies) {
      const depKey = Object.keys(FEATURES).find(
        key => FEATURES[key].code === depCode
      );
      if (depKey && !isFeatureEnabled(depKey)) {
        console.warn(
          `Feature ${featureKey} deshabilitada: dependencia ${depCode} no disponible`
        );
        return false;
      }
    }
  }

  return enabled;
}

/**
 * Obtener todas las features habilitadas
 *
 * @returns {Object}
 */
export function getEnabledFeatures() {
  const enabled = {};
  for (const [key, feature] of Object.entries(FEATURES)) {
    if (isFeatureEnabled(key)) {
      enabled[key] = feature;
    }
  }
  return enabled;
}

/**
 * Hook React para usar feature flags
 */
import { useMemo } from 'react';

export function useFeature(featureKey) {
  return useMemo(() => isFeatureEnabled(featureKey), [featureKey]);
}

// Export default para importar fácilmente
export default {
  FEATURES,
  isFeatureEnabled,
  getEnabledFeatures,
  useFeature
};
```

### 2.2 Uso de Feature Flags en Componentes

#### Ejemplo 1: Ocultar sección completa

```javascript
// App.jsx
import { isFeatureEnabled } from './config/featureFlags';

function App() {
  return (
    <div>
      {/* Tabs de navegación */}
      <nav className="nav-tabs">
        <Link to="/">Calendario</Link>
        <Link to="/stats">Estadísticas</Link>
        <Link to="/handicap">Hándicap</Link>

        {/* Solo mostrar tab Amigos si feature está habilitada */}
        {isFeatureEnabled('FRIENDS_SYSTEM') && (
          <Link to="/friends">Amigos</Link>
        )}
      </nav>

      {/* Rutas */}
      <Routes>
        <Route path="/" element={<CalendarView />} />
        <Route path="/stats" element={<StatsView />} />
        <Route path="/handicap" element={<HandicapView />} />

        {/* Solo registrar ruta si feature está habilitada */}
        {isFeatureEnabled('FRIENDS_SYSTEM') && (
          <Route path="/friends" element={<FriendsView />} />
        )}
      </Routes>
    </div>
  );
}
```

#### Ejemplo 2: Con hook personalizado

```javascript
// CalendarView.jsx
import { useFeature } from './config/featureFlags';

function CalendarView() {
  const canShareTournaments = useFeature('SHARE_TOURNAMENTS');

  return (
    <div>
      <h2>{tournament.name}</h2>

      {/* Botón de compartir solo si feature está habilitada */}
      {canShareTournaments && (
        <button onClick={handleShareTournament}>
          Compartir con Amigos
        </button>
      )}
    </div>
  );
}
```

#### Ejemplo 3: Funcionalidad parcial

```javascript
// StatsView.jsx
import { isFeatureEnabled } from './config/featureFlags';

function StatsView() {
  const hasAdvancedStats = isFeatureEnabled('ADVANCED_STATS');
  const canCompareWithFriends = isFeatureEnabled('COMPARE_STATS');

  return (
    <div>
      {/* Estadísticas básicas (siempre) */}
      <BasicStats />

      {/* Estadísticas avanzadas (solo si feature habilitada) */}
      {hasAdvancedStats && <AdvancedStats />}

      {/* Comparación con amigos */}
      {canCompareWithFriends && <FriendComparison />}
    </div>
  );
}
```

### 2.3 Panel de Administración de Features (Opcional)

**Componente**: `src/components/FeatureFlagsPanel.jsx`

```javascript
import { FEATURES, getEnabledFeatures } from '../config/featureFlags';

function FeatureFlagsPanel() {
  const enabledFeatures = getEnabledFeatures();

  // Solo mostrar en desarrollo
  if (import.meta.env.VITE_ENVIRONMENT !== 'development') {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'white',
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '10px',
      maxWidth: '300px',
      maxHeight: '400px',
      overflow: 'auto',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <h3>Feature Flags</h3>
      <p><strong>Entorno:</strong> {import.meta.env.VITE_ENVIRONMENT}</p>

      <h4>Features Habilitadas:</h4>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {Object.entries(FEATURES).map(([key, feature]) => (
          <li key={key} style={{
            marginBottom: '8px',
            padding: '4px',
            background: enabledFeatures[key] ? '#d4edda' : '#f8d7da',
            borderRadius: '4px'
          }}>
            <strong>{feature.code}</strong>: {feature.name}
            {enabledFeatures[key] ? ' ✅' : ' ❌'}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FeatureFlagsPanel;
```

**Agregar en App.jsx**:
```javascript
import FeatureFlagsPanel from './components/FeatureFlagsPanel';

function App() {
  return (
    <div>
      {/* App normal */}
      <AppContent />

      {/* Panel de features (solo dev) */}
      <FeatureFlagsPanel />
    </div>
  );
}
```

---

## 3. Workflow de Desarrollo

### 3.1 Flujo de Trabajo con Feature Flags

```
┌─────────────────────────────────────────────┐
│ 1. Crear Feature Branch                     │
│    git checkout -b feature/FF-SOCIAL-001    │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ 2. Definir Feature Flag                     │
│    - Agregar en featureFlags.js             │
│    - enabled: { dev: true, stage: false }   │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ 3. Implementar Funcionalidad                │
│    - Envolver con isFeatureEnabled()        │
│    - Probar localmente                      │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ 4. Merge a main (feature deshabilitada)     │
│    - PR y code review                       │
│    - CI/CD ejecuta tests                    │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ 5. Habilitar en Stage                       │
│    - enabled: { stage: true }               │
│    - Deploy a stage                         │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ 6. Testing en Stage                         │
│    - Beta testers validan                   │
│    - Bugs se fixean                         │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ 7. Habilitar en Producción                  │
│    - enabled: { production: true }          │
│    - Deploy gradual (% usuarios)            │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ 8. Monitorear y Validar                     │
│    - Sentry, Analytics                      │
│    - Si hay problemas: rollback flag        │
└─────────────────────────────────────────────┘
```

### 3.2 Comandos Git

```bash
# 1. Crear rama para nueva feature
git checkout -b feature/FF-SOCIAL-001-friends-system

# 2. Trabajar en la feature
git add .
git commit -m "feat(FF-SOCIAL-001): Implementar sistema de amigos

- Agregar componentes FriendsView, AddFriendModal
- Implementar API functions en friendsApi.js
- Feature deshabilitada por defecto (solo dev)
"

# 3. Push y crear PR
git push origin feature/FF-SOCIAL-001-friends-system
gh pr create --title "FF-SOCIAL-001: Sistema de Amigos" --body "Implementa sistema de amigos. Feature flag disabled por defecto."

# 4. Después de merge, habilitar en stage
git checkout main
git pull

# Editar featureFlags.js:
# FRIENDS_SYSTEM.enabled.staging = true

git add src/config/featureFlags.js
git commit -m "chore(FF-SOCIAL-001): Habilitar en staging"
git push origin main

# 5. Deploy a stage (automático con CI/CD)
```

---

## 4. Configuración Firebase

### 4.1 Crear Proyectos Firebase

**Consola Firebase**: https://console.firebase.google.com/

1. **Proyecto Development**:
   - Nombre: `golf-tracker-dev`
   - Plan: Spark (gratis)
   - Authentication: Email/Password habilitado
   - Firestore: Modo test (desarrollo)
   - Hosting: No necesario

2. **Proyecto Staging**:
   - Nombre: `golf-tracker-stage`
   - Plan: Blaze (pago por uso)
   - Authentication: Email/Password habilitado
   - Firestore: Reglas de producción
   - Hosting: Configurado

3. **Proyecto Production** (YA EXISTE):
   - Nombre: `golf-tracker-prod`
   - Plan: Blaze
   - Todo configurado

### 4.2 Configuración Multi-Proyecto

**Archivo**: `src/firebase.js`

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Configuración por entorno
const firebaseConfigs = {
  development: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'golf-tracker-dev',
    storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'golf-tracker-dev'}.appspot.com`,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  },
  staging: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: 'golf-tracker-stage',
    storageBucket: 'golf-tracker-stage.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  },
  production: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: 'golf-tracker-prod',
    storageBucket: 'golf-tracker-prod.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  }
};

const environment = import.meta.env.VITE_ENVIRONMENT || 'development';
const config = firebaseConfigs[environment];

console.log(`🔥 Firebase: Conectando a ${environment} (${config.projectId})`);

export const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Emuladores (solo en desarrollo local)
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  console.log('🔌 Usando emuladores Firebase');
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

### 4.3 Migración de Datos Dev → Stage → Prod

**Script**: `scripts/migrate_data_between_envs.js`

```javascript
import admin from 'firebase-admin';

// Configurar proyectos origen y destino
const sourceProject = admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey-dev.json'),
  projectId: 'golf-tracker-dev'
}, 'source');

const targetProject = admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey-stage.json'),
  projectId: 'golf-tracker-stage'
}, 'target');

const sourceDb = sourceProject.firestore();
const targetDb = targetProject.firestore();

async function migrateCollection(collectionName) {
  console.log(`Migrando colección: ${collectionName}`);

  const snapshot = await sourceDb.collection(collectionName).get();
  const batch = targetDb.batch();

  snapshot.docs.forEach(doc => {
    const targetRef = targetDb.collection(collectionName).doc(doc.id);
    batch.set(targetRef, doc.data());
  });

  await batch.commit();
  console.log(`✅ ${snapshot.size} documentos migrados`);
}

// Ejecutar migración
(async () => {
  await migrateCollection('users');
  await migrateCollection('tournaments');
  console.log('Migración completada');
  process.exit(0);
})();
```

---

## 5. Deploy Automático

### 5.1 GitHub Actions

**Archivo**: `.github/workflows/deploy-stage.yml`

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - main  # Deploy a stage en cada push a main

jobs:
  deploy-stage:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout código
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Instalar dependencias
        run: npm ci

      - name: Ejecutar tests
        run: npm test

      - name: Build para staging
        run: npm run build:stage
        env:
          VITE_ENVIRONMENT: staging
          VITE_FIREBASE_PROJECT_ID: golf-tracker-stage

      - name: Deploy a Vercel (Staging)
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_STAGE }}
          scope: ${{ secrets.VERCEL_ORG_ID }}
```

**Archivo**: `.github/workflows/deploy-production.yml`

```yaml
name: Deploy to Production

on:
  release:
    types: [published]  # Solo deploy a prod en releases

jobs:
  deploy-prod:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout código
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Instalar dependencias
        run: npm ci

      - name: Ejecutar tests
        run: npm test

      - name: Build para production
        run: npm run build
        env:
          VITE_ENVIRONMENT: production
          VITE_FIREBASE_PROJECT_ID: golf-tracker-prod

      - name: Deploy a Vercel (Production)
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_PROD }}
          vercel-args: '--prod'
          scope: ${{ secrets.VERCEL_ORG_ID }}
```

### 5.2 Scripts de Build

**Actualizar**: `package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:stage": "vite build --mode staging",
    "build:prod": "vite build --mode production",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint .",
    "deploy:stage": "npm run build:stage && vercel --prod",
    "deploy:prod": "npm run build:prod && vercel --prod"
  }
}
```

### 5.3 Vercel Configuration

**Archivo**: `vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/GolfTeam/(.*)",
      "dest": "/$1"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "VITE_ENVIRONMENT": "staging"
  }
}
```

---

## 6. Testing en Stage

### 6.1 Usuarios de Testing

Crear usuarios de prueba en Firebase Stage:

```javascript
// scripts/create_test_users.js
import { auth, db } from '../src/firebase.js';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';

const testUsers = [
  {
    email: 'test1@golf-stage.com',
    password: 'Test123!',
    username: 'test_user_1',
    full_name: 'Test User 1'
  },
  {
    email: 'test2@golf-stage.com',
    password: 'Test123!',
    username: 'test_user_2',
    full_name: 'Test User 2'
  }
];

for (const user of testUsers) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    user.email,
    user.password
  );

  await setDoc(doc(db, 'users', userCredential.user.uid), {
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    created_at: new Date().toISOString()
  });

  console.log(`✅ Usuario creado: ${user.email}`);
}
```

### 6.2 Checklist de Testing Stage

```
[ ] Login funciona con usuarios de prueba
[ ] Feature flags están correctamente habilitadas
[ ] Nuevas funcionalidades se muestran
[ ] No hay errores en consola
[ ] Performance es aceptable
[ ] Datos se guardan correctamente en Firestore Stage
[ ] No afecta a base de datos de producción
[ ] URLs compartidas funcionan
[ ] Analytics reporta correctamente
```

---

## 7. Resumen de Implementación

### Paso 1: Crear proyectos Firebase
```bash
# Desde Firebase Console
1. Crear golf-tracker-dev
2. Crear golf-tracker-stage
3. Configurar Authentication y Firestore
```

### Paso 2: Configurar variables de entorno
```bash
# Crear archivos
touch .env.local
touch .env.stage
touch .env.production

# Configurar cada uno según sección 1.3
```

### Paso 3: Implementar sistema de feature flags
```bash
# Crear archivo
touch src/config/featureFlags.js

# Copiar código de sección 2.1
```

### Paso 4: Configurar CI/CD
```bash
# Crear workflows
mkdir -p .github/workflows
touch .github/workflows/deploy-stage.yml
touch .github/workflows/deploy-production.yml

# Configurar secrets en GitHub
- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID_STAGE
- VERCEL_PROJECT_ID_PROD
```

### Paso 5: Primer deploy a stage
```bash
git checkout -b setup/stage-environment
git add .
git commit -m "feat: Setup staging environment and feature flags"
git push origin setup/stage-environment

# Merge PR
# Deploy automático a stage ✅
```

---

**Última actualización**: 17 de marzo de 2026
**Mantenido por**: Reinaldo Moon

# Plan de Escalabilidad - Golf Tracker

**Objetivo**: Preparar la aplicación para miles de usuarios
**Fecha**: 17 de marzo de 2026
**Estado**: Pendiente de implementación

---

## 📋 Índice

1. [Testing Funcional Completo](#1-testing-funcional-completo)
2. [Seguridad Firestore](#2-seguridad-firestore)
3. [Optimizaciones de Rendimiento](#3-optimizaciones-de-rendimiento)
4. [Limpieza de Código Legacy](#4-limpieza-de-código-legacy)
5. [Monitoreo y Analytics](#5-monitoreo-y-analytics)
6. [Plan de Testing de Carga](#6-plan-de-testing-de-carga)
7. [Checklist Final](#7-checklist-final)

---

## 1. Testing Funcional Completo

### Objetivo
Validar que toda la migración a Firebase funciona correctamente antes de escalar.

### Test Cases

#### 1.1 Autenticación y Sesión
```
[ ] Login con email/password (nicole@golfteam.app)
[ ] Login con email/password (txell@golfteam.app)
[ ] Login con email/password (david@golfteam.app)
[ ] Mensaje de error con credenciales incorrectas
[ ] Registro de nuevo usuario
[ ] Recuperación de contraseña
[ ] Cierre de sesión
[ ] Re-login después de cerrar sesión
[ ] Persistencia de sesión (recargar página)
[ ] Auto-login en modo single (nicole)
```

#### 1.2 Perfil de Usuario
```
[ ] Cargar perfil correctamente tras login
[ ] Mostrar foto de perfil (Cloudflare R2)
[ ] Editar nombre completo
[ ] Editar email
[ ] Editar número de licencia federativa
[ ] Subir nueva foto de perfil
[ ] Foto se actualiza en tiempo real
[ ] Restaurar perfil desde legacy (botón de recuperación)
```

#### 1.3 Manager Mode
```
[ ] David ve lista de cuentas gestionadas (maria, sofia)
[ ] Cambiar de maria a sofia (switch)
[ ] Cambiar de sofia a david (switch)
[ ] Volver a maria desde david
[ ] Cada cambio carga los datos correctos
[ ] Avatares se muestran correctamente
[ ] localStorage persiste usuario activo
[ ] Al recargar, mantiene último usuario activo
```

#### 1.4 Sistema de Hándicap
```
[ ] Cargar hándicap al iniciar sesión (cache)
[ ] Actualizar hándicap manualmente (botón)
[ ] Cache se considera fresco antes de las 08:00
[ ] Cache se invalida después de las 08:00
[ ] Descargar PDF del historial
[ ] Hándicap se guarda en Firestore
[ ] Hándicap se sincroniza entre dispositivos
[ ] Probar con usuario sin licencia federativa
[ ] Probar con usuario con licencia federativa
```

#### 1.5 Resultados
```
[ ] Crear nuevo resultado para torneo oficial
[ ] Crear nuevo resultado para torneo personalizado
[ ] Editar resultado existente
[ ] Eliminar resultado
[ ] Resultado se sincroniza en tiempo real
[ ] Scorecard hoyo por hoyo (18 hoyos)
[ ] Scorecard hoyo por hoyo (36 hoyos - 2 vueltas)
[ ] Putts, GIR, fairways se guardan correctamente
[ ] Total automático de golpes
[ ] Cálculo correcto de neto (con hándicap)
```

#### 1.6 Torneos Personalizados
```
[ ] Crear torneo personalizado
[ ] Editar torneo personalizado
[ ] Eliminar torneo personalizado
[ ] Torneo se sincroniza en tiempo real
[ ] Torneo personalizado no se muestra a otros usuarios
[ ] Filtrar torneos por temporada (2026, 2025)
[ ] Ocultar torneo oficial (hiddenIds)
```

#### 1.7 Modo Live (Compartir)
```
[ ] Compartir resultado individual (1 vuelta)
[ ] Compartir resultado individual (2 vueltas)
[ ] URL incluye nombre del jugador
[ ] URL incluye ubicación del torneo
[ ] Vista live muestra total acumulado (2 vueltas)
[ ] Vista live muestra cada vuelta individual
[ ] Vista live se actualiza en tiempo real
[ ] Compartir resultado multi-jugador (team)
```

#### 1.8 Estadísticas
```
[ ] Ver estadísticas propias
[ ] Gráfico de evolución de scores
[ ] Promedio de birdies/eagles/bogeys
[ ] Mejores/peores campos
[ ] Estadísticas por temporada
```

---

## 2. Seguridad Firestore

### Objetivo
Implementar reglas de seguridad robustas para proteger datos de usuarios.

### Reglas de Seguridad Actuales (INSEGURAS)

```javascript
// firestore.rules (ESTADO ACTUAL - MODO DESARROLLO)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // WARNING: Reglas permisivas para desarrollo
    match /{document=**} {
      allow read, write: if true; // ⚠️ PELIGRO: Acceso total
    }
  }
}
```

### Reglas de Seguridad Objetivo (PRODUCCIÓN)

**Archivo**: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ========================================
    // USUARIOS - Solo lectura/escritura propia
    // ========================================
    match /users/{uid} {
      // Leer solo tu propio perfil O perfiles públicos compartidos
      allow read: if request.auth != null && (
        request.auth.uid == uid ||
        resource.data.privacy.show_profile_to_public == true
      );

      // Escribir solo tu propio perfil
      allow write: if request.auth != null && request.auth.uid == uid;

      // ========================================
      // SUBCOLECCIÓN: RESULTADOS
      // ========================================
      match /results/{resultId} {
        // Leer tus resultados O resultados compartidos contigo
        allow read: if request.auth != null && (
          request.auth.uid == uid ||
          resource.data.shared_with_friends == true
        );

        // Escribir solo tus propios resultados
        allow write: if request.auth != null && request.auth.uid == uid;
      }

      // ========================================
      // SUBCOLECCIÓN: TORNEOS PERSONALIZADOS
      // ========================================
      match /custom_tournaments/{tournamentId} {
        // Leer tus torneos O torneos compartidos contigo
        allow read: if request.auth != null && (
          request.auth.uid == uid ||
          request.auth.uid in resource.data.shared_with
        );

        // Escribir solo tus propios torneos
        allow write: if request.auth != null && request.auth.uid == uid;
      }

      // ========================================
      // SUBCOLECCIÓN: PREFERENCIAS
      // ========================================
      match /settings/{settingId} {
        allow read: if request.auth != null && request.auth.uid == uid;
        allow write: if request.auth != null && request.auth.uid == uid;
      }

      // ========================================
      // SUBCOLECCIÓN: AMIGOS (FUTURO)
      // ========================================
      match /friends/{friendId} {
        allow read: if request.auth != null && request.auth.uid == uid;
        allow write: if request.auth != null && request.auth.uid == uid;
      }
    }

    // ========================================
    // MAPPING USERNAMES
    // ========================================
    match /usernames/{username} {
      // Cualquier usuario autenticado puede leer (para buscar amigos)
      allow read: if request.auth != null;

      // Solo admins o Cloud Functions pueden escribir
      allow write: if false;
    }

    // ========================================
    // TORNEOS OFICIALES
    // ========================================
    match /tournaments/{tournamentId} {
      // Lectura pública (todos pueden ver torneos oficiales)
      allow read: if true;

      // Solo admins pueden escribir
      allow write: if false;
    }

    // ========================================
    // SOLICITUDES DE AMISTAD (FUTURO)
    // ========================================
    match /friend_requests/{requestId} {
      // Leer solo si eres el remitente o destinatario
      allow read: if request.auth != null && (
        resource.data.from_uid == request.auth.uid ||
        resource.data.to_uid == request.auth.uid
      );

      // Crear solo si eres el remitente
      allow create: if request.auth != null &&
        request.resource.data.from_uid == request.auth.uid &&
        request.resource.data.status == 'pending';

      // Actualizar solo si eres el destinatario (aceptar/rechazar)
      allow update: if request.auth != null &&
        resource.data.to_uid == request.auth.uid &&
        request.resource.data.status in ['accepted', 'rejected'];

      // No se puede eliminar
      allow delete: if false;
    }

    // ========================================
    // TORNEOS COMPARTIDOS (FUTURO)
    // ========================================
    match /shared_tournaments/{sharedId} {
      // Leer solo si eres el destinatario o el propietario
      allow read: if request.auth != null && (
        resource.data.shared_with_uid == request.auth.uid ||
        resource.data.owner_uid == request.auth.uid
      );

      // Crear solo si eres el propietario
      allow create: if request.auth != null &&
        request.resource.data.owner_uid == request.auth.uid;

      // Actualizar/eliminar solo si eres el propietario
      allow update, delete: if request.auth != null &&
        resource.data.owner_uid == request.auth.uid;
    }

    // Bloquear todo lo demás
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Funciones Helper para Reglas (Versión Avanzada)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: Usuario está autenticado
    function isSignedIn() {
      return request.auth != null;
    }

    // Helper: Usuario es el dueño del documento
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    // Helper: Usuario tiene rol de admin
    function isAdmin() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Helper: Usuario es amigo del dueño
    function isFriend(ownerUid) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/users/$(ownerUid)/friends/$(request.auth.uid));
    }

    // Helper: Recurso es público
    function isPublic() {
      return resource.data.is_public == true;
    }

    // Aplicar helpers
    match /users/{uid} {
      allow read: if isSignedIn() && (isOwner(uid) || isPublic());
      allow write: if isOwner(uid);

      match /results/{resultId} {
        allow read: if isOwner(uid) || isFriend(uid);
        allow write: if isOwner(uid);
      }
    }

    // ... resto de reglas
  }
}
```

### Testing de Reglas

**Archivo**: `firestore-rules-test.js`

```javascript
const firebase = require('@firebase/testing');
const fs = require('fs');

const PROJECT_ID = 'golf-tracker-test';

describe('Firestore Security Rules', () => {
  let db;
  let auth;

  beforeAll(async () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    await firebase.loadFirestoreRules({
      projectId: PROJECT_ID,
      rules: rules
    });
  });

  afterAll(async () => {
    await firebase.clearFirestoreData({ projectId: PROJECT_ID });
    await Promise.all(firebase.apps().map(app => app.delete()));
  });

  // TEST: Usuario puede leer su propio perfil
  test('Usuario puede leer su propio perfil', async () => {
    const db = firebase.initializeTestApp({
      projectId: PROJECT_ID,
      auth: { uid: 'alice', email: 'alice@test.com' }
    }).firestore();

    const docRef = db.collection('users').doc('alice');
    await firebase.assertSucceeds(docRef.get());
  });

  // TEST: Usuario NO puede leer perfil ajeno
  test('Usuario NO puede leer perfil ajeno privado', async () => {
    const db = firebase.initializeTestApp({
      projectId: PROJECT_ID,
      auth: { uid: 'alice', email: 'alice@test.com' }
    }).firestore();

    const docRef = db.collection('users').doc('bob');
    await firebase.assertFails(docRef.get());
  });

  // TEST: Usuario puede escribir su propio perfil
  test('Usuario puede escribir su propio perfil', async () => {
    const db = firebase.initializeTestApp({
      projectId: PROJECT_ID,
      auth: { uid: 'alice', email: 'alice@test.com' }
    }).firestore();

    const docRef = db.collection('users').doc('alice');
    await firebase.assertSucceeds(docRef.set({ full_name: 'Alice Test' }));
  });

  // TEST: Usuario NO puede escribir perfil ajeno
  test('Usuario NO puede escribir perfil ajeno', async () => {
    const db = firebase.initializeTestApp({
      projectId: PROJECT_ID,
      auth: { uid: 'alice', email: 'alice@test.com' }
    }).firestore();

    const docRef = db.collection('users').doc('bob');
    await firebase.assertFails(docRef.set({ full_name: 'Hacked' }));
  });

  // TEST: Usuario puede leer sus propios resultados
  test('Usuario puede leer sus propios resultados', async () => {
    const db = firebase.initializeTestApp({
      projectId: PROJECT_ID,
      auth: { uid: 'alice', email: 'alice@test.com' }
    }).firestore();

    const docRef = db.collection('users').doc('alice').collection('results').doc('result1');
    await firebase.assertSucceeds(docRef.get());
  });

  // Más tests...
});
```

**Ejecutar tests**:
```bash
npm install --save-dev @firebase/testing
npm test
```

---

## 3. Optimizaciones de Rendimiento

### 3.1 Índices Firestore

**Archivo**: `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "results",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "created_at", "order": "DESCENDING" },
        { "fieldPath": "tournament_id", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "custom_tournaments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "dates", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "friend_requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "to_uid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Desplegar índices**:
```bash
firebase deploy --only firestore:indexes
```

### 3.2 Optimización de Queries

#### ANTES (Ineficiente)
```javascript
// Cargar TODOS los resultados y filtrar en cliente
const resultsSnap = await getDocs(collection(db, 'users', uid, 'results'));
const filteredResults = resultsSnap.docs.filter(doc => {
  const year = getYear(doc.data().date);
  return year === currentSeason;
});
```

#### DESPUÉS (Eficiente)
```javascript
// Filtrar en servidor con query
const resultsRef = collection(db, 'users', uid, 'results');
const q = query(
  resultsRef,
  where('season', '==', currentSeason),
  orderBy('created_at', 'desc'),
  limit(50)
);
const resultsSnap = await getDocs(q);
```

### 3.3 Paginación

**Implementar paginación en resultados**:

```javascript
// src/hooks/usePaginatedResults.js
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';

export function usePaginatedResults(db, uid, pageSize = 20) {
  const [results, setResults] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const resultsRef = collection(db, 'users', uid, 'results');
      let q = query(
        resultsRef,
        orderBy('created_at', 'desc'),
        limit(pageSize)
      );

      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setHasMore(false);
      } else {
        const newResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setResults(prev => [...prev, ...newResults]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === pageSize);
      }
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMore();
  }, []);

  return { results, loading, hasMore, loadMore };
}
```

**Uso en componente**:
```javascript
function StatsView({ user }) {
  const { results, loading, hasMore, loadMore } = usePaginatedResults(db, user.uid);

  return (
    <div>
      {results.map(result => <ResultCard key={result.id} result={result} />)}
      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? 'Cargando...' : 'Cargar más'}
        </button>
      )}
    </div>
  );
}
```

### 3.4 Cache de Estadísticas

**Problema**: Calcular estadísticas en cada vista es costoso.

**Solución**: Precalcular stats mensualmente y cachear.

```javascript
// Cloud Function: Ejecutar cada noche a las 02:00
exports.calculateMonthlyStats = functions.pubsub
  .schedule('0 2 1 * *') // Día 1 de cada mes a las 02:00
  .timeZone('Europe/Madrid')
  .onRun(async (context) => {
    const usersSnap = await admin.firestore().collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const stats = await calculateUserStats(uid);

      await admin.firestore()
        .collection('users')
        .doc(uid)
        .collection('stats_cache')
        .doc('monthly')
        .set({
          ...stats,
          calculated_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }
  });

async function calculateUserStats(uid) {
  const resultsSnap = await admin.firestore()
    .collection('users')
    .doc(uid)
    .collection('results')
    .get();

  // Calcular estadísticas
  let totalScore = 0;
  let count = 0;

  resultsSnap.forEach(doc => {
    const result = doc.data();
    if (result.score) {
      totalScore += result.score;
      count++;
    }
  });

  return {
    avg_score: count > 0 ? (totalScore / count).toFixed(1) : 0,
    total_rounds: count
  };
}
```

### 3.5 Optimización de Imágenes

**Comprimir imágenes antes de subir a R2**:

```javascript
// src/utils/imageCompression.js
export async function compressImage(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
```

**Uso en App.jsx**:
```javascript
import { compressImage } from './utils/imageCompression';

const handlePhotoUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setIsUploadingPhoto(true);

  try {
    // Comprimir imagen
    const compressedFile = await compressImage(file, 800, 0.85);

    // Subir a R2
    const fileName = `${user.username}_${Math.floor(Date.now() / 1000)}.jpg`;
    const arrayBuffer = await compressedFile.arrayBuffer();

    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: fileName,
      Body: new Uint8Array(arrayBuffer),
      ContentType: 'image/jpeg'
    });

    await s3Client.send(command);
    // ... resto del código
  } catch (error) {
    console.error('Error uploading photo:', error);
  } finally {
    setIsUploadingPhoto(false);
  }
};
```

---

## 4. Limpieza de Código Legacy

### 4.1 Archivos a Eliminar

```bash
# APIs PHP obsoletas (tras validar que no se usan)
public/api/login.php
public/api/create_user.php
public/api/update_user.php
public/api/save_results.php
public/api/save_preferences.php
public/api/save_custom_tournaments.php
public/api/users.json

# Componente de login obsoleto
src/components/LoginView.jsx
```

### 4.2 Validar que no se usan

**Buscar referencias en código**:
```bash
# Buscar referencias a login.php
grep -r "login.php" src/

# Buscar referencias a create_user.php
grep -r "create_user.php" src/

# Buscar referencias a LoginView (viejo)
grep -r "LoginView" src/ | grep -v "LoginViewFirebase"
```

### 4.3 Mantener Temporalmente

```bash
# Mantener hasta que se migre scraping a Cloud Functions
public/api/get_handicap.php
public/api/get_handicap_history_pdf.php
public/api/save_handicap_history.php
```

---

## 5. Monitoreo y Analytics

### 5.1 Firebase Analytics

**Configurar eventos personalizados**:

```javascript
// src/firebase.js
import { getAnalytics, logEvent } from 'firebase/analytics';

export const analytics = getAnalytics(app);

// Eventos personalizados
export function trackEvent(eventName, params = {}) {
  logEvent(analytics, eventName, params);
}

// Ejemplos de uso
trackEvent('login_success', { method: 'email' });
trackEvent('result_saved', { tournament_id: '123', score: 85 });
trackEvent('handicap_updated', { new_handicap: 12.5 });
trackEvent('tournament_shared', { tournament_id: '123', shared_with: 'live_url' });
```

**Eventos a trackear**:
```javascript
// Autenticación
trackEvent('login_success');
trackEvent('login_failed');
trackEvent('user_registered');

// Resultados
trackEvent('result_created');
trackEvent('result_updated');
trackEvent('result_deleted');

// Compartir
trackEvent('live_shared');
trackEvent('scorecard_captured');

// Hándicap
trackEvent('handicap_updated');
trackEvent('handicap_pdf_downloaded');

// Engagement
trackEvent('session_start');
trackEvent('session_end', { duration_minutes: 15 });
```

### 5.2 Error Monitoring (Sentry)

```bash
npm install @sentry/react
```

```javascript
// src/main.jsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://your-sentry-dsn@sentry.io/project-id',
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});
```

### 5.3 Performance Monitoring

```javascript
// src/utils/performance.js
export function measurePerformance(name, fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();

  console.log(`[PERF] ${name}: ${(end - start).toFixed(2)}ms`);

  // Enviar a Analytics
  trackEvent('performance_metric', {
    metric_name: name,
    duration_ms: Math.round(end - start)
  });

  return result;
}

// Uso
const results = measurePerformance('load_results', () => {
  return getDocs(collection(db, 'users', uid, 'results'));
});
```

---

## 6. Plan de Testing de Carga

### 6.1 Herramientas

- **Artillery** - Load testing
- **K6** - Performance testing
- **Firebase Performance Monitoring** - Real-time metrics

### 6.2 Escenarios de Carga

```yaml
# artillery-load-test.yml
config:
  target: 'https://reinaldomoon.top/GolfTeam/'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 usuarios/segundo
      name: "Warm up"
    - duration: 300
      arrivalRate: 50  # 50 usuarios/segundo
      name: "Ramp up"
    - duration: 600
      arrivalRate: 100 # 100 usuarios/segundo
      name: "Sustained load"

scenarios:
  - name: "User Login and View Results"
    flow:
      - get:
          url: "/"
      - think: 5
      - post:
          url: "/api/login"
          json:
            email: "test@test.com"
            password: "test123"
      - think: 3
      - get:
          url: "/stats"
```

**Ejecutar**:
```bash
npm install -g artillery
artillery run artillery-load-test.yml
```

### 6.3 Métricas a Medir

```
✅ Tiempo de respuesta promedio < 500ms
✅ P95 (percentil 95) < 1000ms
✅ P99 (percentil 99) < 2000ms
✅ Tasa de error < 0.1%
✅ Throughput > 100 req/s
✅ Usuarios concurrentes > 1000
```

---

## 7. Checklist Final

### 7.1 Pre-Deploy Checklist

```
[ ] Testing funcional completado (100%)
[ ] Reglas de seguridad Firestore implementadas
[ ] Índices Firestore desplegados
[ ] Paginación implementada
[ ] Cache de estadísticas configurado
[ ] Compresión de imágenes activada
[ ] Código legacy eliminado
[ ] Firebase Analytics configurado
[ ] Error monitoring (Sentry) configurado
[ ] Load testing ejecutado y aprobado
[ ] Backup de base de datos realizado
[ ] Plan de rollback definido
```

### 7.2 Post-Deploy Checklist

```
[ ] Verificar login funciona para todos los usuarios
[ ] Verificar datos se cargan correctamente
[ ] Verificar reglas de seguridad activas
[ ] Monitorear errores en Sentry (primeras 24h)
[ ] Monitorear métricas en Firebase Console
[ ] Revisar logs de Cloud Functions
[ ] Validar que no hay queries sin índices
[ ] Confirmar que cache funciona
[ ] Probar con usuarios reales (beta testers)
```

### 7.3 Métricas de Éxito

```
✅ 0 errores críticos en primeras 48h
✅ Tiempo de carga < 2s
✅ Disponibilidad > 99.9%
✅ Satisfacción de usuarios > 4.5/5
✅ Tasa de conversión (registro) > 60%
```

---

## 8. Estimación de Tiempos

| Tarea | Tiempo Estimado | Prioridad |
|-------|----------------|-----------|
| Testing funcional completo | 2-3 días | 🔴 CRÍTICO |
| Implementar reglas Firestore | 1 día | 🔴 CRÍTICO |
| Crear índices Firestore | 2 horas | 🔴 CRÍTICO |
| Implementar paginación | 1 día | 🟡 ALTA |
| Cache de estadísticas | 2 días | 🟡 ALTA |
| Comprimir imágenes | 4 horas | 🟡 ALTA |
| Eliminar código legacy | 2 horas | 🟢 MEDIA |
| Configurar Analytics | 4 horas | 🟢 MEDIA |
| Configurar Sentry | 2 horas | 🟢 MEDIA |
| Load testing | 1 día | 🟡 ALTA |

**Total estimado**: 7-10 días de trabajo

---

## 9. Orden de Implementación

### Semana 1 (CRÍTICO)
1. ✅ Testing funcional completo
2. ✅ Implementar reglas de seguridad Firestore
3. ✅ Crear índices Firestore
4. ✅ Eliminar código PHP legacy

### Semana 2 (OPTIMIZACIÓN)
5. ✅ Implementar paginación
6. ✅ Compresión de imágenes
7. ✅ Cache de estadísticas
8. ✅ Firebase Analytics

### Semana 3 (VALIDACIÓN)
9. ✅ Configurar Sentry
10. ✅ Load testing
11. ✅ Validación final
12. ✅ Deploy a producción

---

**Última actualización**: 17 de marzo de 2026
**Mantenido por**: Reinaldo Moon

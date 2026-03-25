# Documentación Técnica - Golf Tracker PWA

**Versión**: 2.4.8
**Última actualización**: 16 de marzo de 2026
**Estado**: En producción con migración Firebase completada

---

## Índice

1. [Descripción del Proyecto](#descripción-del-proyecto)
2. [Arquitectura Técnica](#arquitectura-técnica)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estructura de Datos](#estructura-de-datos)
5. [Flujos Principales](#flujos-principales)
6. [Configuración Firebase](#configuración-firebase)
7. [APIs y Servicios](#apis-y-servicios)
8. [Componentes React Principales](#componentes-react-principales)
9. [Sistema de Hándicap](#sistema-de-hándicap)
10. [Manager Mode](#manager-mode)
11. [PWA y Service Workers](#pwa-y-service-workers)
12. [Scripts de Migración](#scripts-de-migración)
13. [Estado Actual y TODOs](#estado-actual-y-todos)
14. [Guías de Desarrollo](#guías-de-desarrollo)

---

## Descripción del Proyecto

**Golf Tracker** es una Progressive Web App para gestionar:
- Calendarios de torneos de golf (RFEG, FCG, clubs locales)
- Resultados y scorecards hoyo por hoyo
- Hándicap oficial automático desde RFEG
- Estadísticas y análisis de rendimiento
- Múltiples perfiles (modo manager para padres/tutores)

**Usuarios principales**: Jugadores juveniles de golf en Cataluña, España.

**URL Producción**: https://reinaldomoon.top/GolfTeam/

---

## Arquitectura Técnica

### Diagrama General

```
┌─────────────────┐
│   React PWA     │ ← Frontend (Vite + React 19)
│   (Cliente)     │
└────────┬────────┘
         │
         ├─────────────────────────────────────────┐
         │                                         │
         ▼                                         ▼
┌────────────────────┐                   ┌─────────────────┐
│  Firebase Cloud    │                   │  APIs PHP       │
│  (Auth + Firestore)│                   │  (Legacy)       │
│                    │                   │                 │
│ • Authentication   │                   │ • get_handicap  │
│ • users/{uid}      │                   │ • get_pdf       │
│ • tournaments      │                   │ • save_handicap │
│ • usernames/{name} │                   └─────────────────┘
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Cloudflare R2     │ ← Almacenamiento fotos
│  (CDN Worker)      │
└────────────────────┘
```

### Modos de Operación

El app tiene dos modos configurables vía variable de entorno:

```javascript
// En App.jsx línea 81
const APP_MODE = import.meta.env.VITE_APP_MODE || 'single';
const IS_MULTI = APP_MODE === 'multi';

// Single Mode: Auto-login como 'nicole' (modo personal)
// Multi Mode: Login Firebase requerido (modo equipo)
```

**Variables de entorno** (`vite.config.js` o `.env`):
```bash
VITE_APP_MODE=multi  # 'single' o 'multi'
VITE_BASE_URL=/      # Base path de la app
```

---

## Stack Tecnológico

### Frontend
- **React 19.2.0** - Framework principal
- **Vite 7.2.4** - Build tool y dev server
- **React Router DOM 7.12.0** - Navegación SPA
- **Chart.js 4.5.1** + react-chartjs-2 - Gráficos
- **Lucide React 0.562.0** - Iconos
- **html2canvas 1.4.1** - Capturas de pantalla

### Backend/Infraestructura
- **Firebase 12.9.0**
  - Authentication (Email/Password)
  - Cloud Firestore (Base de datos NoSQL)
- **AWS SDK S3 3.1000.0** - Cliente para Cloudflare R2
- **PHP 7.x+** - APIs legacy (en proceso de eliminación)

### Herramientas de Scraping (Scripts)
- **Puppeteer 24.36.1** - Automatización navegador
- **Cheerio 1.2.0** - Parsing HTML
- **Axios 1.13.4** - HTTP client
- **pdf-parse 1.1.1** - Extracción de texto PDF

### PWA
- **vite-plugin-pwa 1.2.0** - Service Worker automático
- **Workbox** (integrado) - Estrategias de cache

---

## Estructura de Datos

### Firestore Schema

#### Colección: `users/{uid}`
```javascript
{
  username: "nicole",           // Alias único
  uid: "firebase-auth-uid",     // ID autenticación Firebase
  full_name: "Nicole Likhomanova",
  email: "nicole@example.com",
  federation_id: "CB00123456",  // Nº licencia RFEG (opcional)
  photo_url: "https://golf-cdn.misterpotatolightyear.workers.dev/nicole_1234567890.jpg",
  current_handicap: "12.5",
  handicap_pdf_url: "https://...",
  handicap_fetched_at: "2026-03-16T08:00:00.000Z",
  managed_users: ["maria", "sofia"], // Solo para managers
  role: "manager" | "player",        // Opcional
  created_at: Timestamp,
  updated_at: Timestamp
}
```

#### Subcolección: `users/{uid}/results/{tournamentId}`
```javascript
{
  score: 85,
  gross: 85,
  net: 73,
  position: 5,
  participants: 20,
  course: "Golf Costa Daurada",
  holes: [
    { hole: 1, par: 4, score: 5, putts: 2, fairway: false, gir: false },
    // ... 18 hoyos
  ],
  date: "2026-03-15",
  notes: "Buen juego en general",
  created_at: Timestamp,
  updated_at: Timestamp
}
```

#### Subcolección: `users/{uid}/custom_tournaments/{tournamentId}`
```javascript
{
  id: "custom_1234567890",
  name: "Torneo Local Primavera",
  dates: "15/03/2026",
  location: "Golf Tarragona",
  organization: "club",
  type: "strokeplay",
  color: "#4CAF50",
  custom: true,
  created_by: "nicole",
  created_at: Timestamp
}
```

#### Subcolección: `users/{uid}/settings/preferences`
```javascript
{
  groups: ["juvenil", "rfeg", "fcg", "club", "adultos"],
  hiddenIds: [105, 2, 110], // IDs de torneos ocultos
  themes: {
    "RFEG": { bg: "#e3f2fd", border: "#1976d2" },
    "FCG": { bg: "#fff3e0", border: "#f57c00" }
  }
}
```

#### Colección: `tournaments/{tournamentId}`
```javascript
{
  id: 1,
  name: "Campeonato de Cataluña Juvenil",
  dates: "20/03/2026 - 21/03/2026",
  location: "Real Club de Golf El Prat",
  organization: "FCG",
  category: "Juvenil",
  type: "strokeplay" | "match" | "merit",
  details: "Descripción...",
  official: true
}
```

#### Colección: `usernames/{username}`
Mapping para resolver username → uid:
```javascript
{
  uid: "firebase-auth-uid",
  username: "nicole",
  updated_at: Timestamp
}
```

### LocalStorage Schema

```javascript
// Cache de usuario activo
localStorage.setItem('golf_tracker_user', JSON.stringify({
  username: "nicole",
  uid: "...",
  full_name: "Nicole Likhomanova",
  manager_id: "david" // Solo si es cuenta gestionada
}));

// Cache de usuarios enlazados (manager mode)
localStorage.setItem('golf_tracker_linked_users', JSON.stringify([
  { username: "david", ... },
  { username: "maria", ... },
  { username: "sofia", ... }
]));

// Cache de hándicap
localStorage.setItem('golf_tracker_handicap_cache_nicole', JSON.stringify({
  handicap: "12.5",
  pdfUrl: "https://...",
  fetchedAt: 1710576000000
}));
```

---

## Flujos Principales

### 1. Flujo de Autenticación (Multi Mode)

```javascript
// src/App.jsx líneas 398-487

// 1. Listener de autenticación Firebase
onAuthStateChanged(auth, async (authUser) => {
  if (!authUser) {
    resetSessionState();
    return;
  }

  // 2. Resolver perfil por UID
  const resolvedProfile = await fetchUserProfileByUid(db, authUser.uid, authUser.email);

  // 3. Asegurar documento en Firestore
  const ownerProfile = await ensureUserProfileDocument(db, {
    uid: authUser.uid,
    username: resolvedProfile?.username || authUser.email.split('@')[0],
    email: authUser.email,
    full_name: resolvedProfile?.full_name || authUser.displayName
  }, inferredUsername);

  // 4. Cargar cuentas gestionadas si existe managed_users
  const managedProfiles = await loadManagedProfiles(ownerProfile);

  // 5. Determinar usuario activo (owner o uno de los gestionados)
  let activeUser = ownerProfile;
  if (managedProfiles.length > 0) {
    // Preferir el último usuario activo guardado en localStorage
    activeUser = savedActiveUser || firstManagedUser || ownerProfile;
  }

  // 6. Actualizar estado
  setUser(activeUser);
  setLinkedUsers(managedProfiles);
});
```

**Funciones helper** (`src/utils/userProfiles.js`):
```javascript
// Obtener perfil por UID
export async function fetchUserProfileByUid(db, uid, fallbackEmail = null);

// Obtener perfil por username (usa mapping usernames/{username})
export async function fetchUserProfileByUsername(db, username);

// Crear/actualizar documento de usuario
export async function ensureUserProfileDocument(db, userData, username);

// Obtener ID del documento (uid o username según contexto)
export function getUserDocId(userLike);

// Referencias Firestore
export function getUserProfileRef(db, userLike);
export function getUserSubcollectionRef(db, userLike, subcollectionName);
export function getUserSubdocRef(db, userLike, subcollectionName, docId);
```

### 2. Flujo de Actualización de Hándicap

```javascript
// src/App.jsx líneas 858-916

async function refreshHandicap({ force = false, background = false } = {}) {
  // 1. Verificar cache existente
  const existingCache = readHandicapCache(user);
  const cachedFetchedAt = existingCache?.fetchedAt || user.handicap_fetched_at;

  // 2. Si cache es fresco (< 08:00 AM hoy) y no es forzado, usar cache
  if (!force && isHandicapCacheFresh(cachedFetchedAt)) {
    applyCachedHandicap(user);
    return;
  }

  // 3. Llamar API PHP (scraping RFEG)
  const licenseParam = user.federation_id ? `&license=${user.federation_id}` : '';
  const res = await fetch(
    `${baselink}/api/get_handicap.php?username=${user.username}${licenseParam}&t=${Date.now()}`
  );
  const data = await res.json();

  // 4. Actualizar cache local
  writeHandicapCache(user, {
    handicap: data.handicap,
    pdfUrl: data.pdf_url,
    fetchedAt: Date.now()
  });

  // 5. Persistir en Firestore
  await setDoc(getUserProfileRef(db, user), {
    current_handicap: data.handicap,
    handicap_pdf_url: data.pdf_url,
    handicap_fetched_at: new Date().toISOString()
  }, { merge: true });

  // 6. Actualizar estado React
  setHandicap(data.handicap);
  setPdfUrl(data.pdf_url);
}

// Cache considerado "fresco" si fue actualizado después de las 08:00 AM de hoy
function isHandicapCacheFresh(fetchedAtValue) {
  const fetchedAt = normalizeTimestamp(fetchedAtValue);
  const now = new Date();
  const todayAtEight = new Date(now);
  todayAtEight.setHours(8, 0, 0, 0);

  if (now < todayAtEight) {
    // Si aún no son las 08:00, cache válido si es de hoy
    return fetchedAt >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  // Si ya pasaron las 08:00, cache válido si es posterior a las 08:00
  return fetchedAt >= todayAtEight.getTime();
}
```

**Auto-actualización diaria** (líneas 919-930):
```javascript
useEffect(() => {
  const checkTime = () => {
    const now = new Date();
    if (now.getHours() === 8 && now.getMinutes() === 0) {
      refreshHandicap();
    }
  };
  const intervalId = setInterval(checkTime, 60000); // Cada minuto
  return () => clearInterval(intervalId);
}, [user]);
```

### 3. Flujo de Guardado de Resultados

```javascript
// src/App.jsx líneas 956-1044

// Función legacy (CalendarView pasa objeto completo)
async function handleUpdateResults(newResults) {
  setResults(newResults); // Optimistic UI

  // Iterar y guardar cada resultado en Firestore
  for (const [tId, result] of Object.entries(newResults)) {
    await setDoc(getUserSubdocRef(db, user, "results", tId), result);
  }
}

// Función granular (preferida)
async function handleSaveSpecificResult(id, data) {
  setResults(prev => ({ ...prev, [id]: data }));
  await setDoc(getUserSubdocRef(db, user, "results", id), data);
}

// Eliminar resultado
async function handleDeleteResult(id) {
  setResults(prev => {
    const next = { ...prev };
    delete next[id];
    return next;
  });
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(getUserSubdocRef(db, user, "results", id));
}
```

### 4. Flujo de Subida de Foto

```javascript
// src/App.jsx líneas 280-320

async function handlePhotoUpload(file) {
  // 1. Generar nombre único
  const fileName = `${user.username}_${Math.floor(Date.now() / 1000)}.jpg`;

  // 2. Subir a Cloudflare R2
  const arrayBuffer = await file.arrayBuffer();
  const command = new PutObjectCommand({
    Bucket: "golf-profiles-bucket",
    Key: fileName,
    Body: new Uint8Array(arrayBuffer),
    ContentType: file.type || 'image/jpeg'
  });
  await s3Client.send(command);

  // 3. Construir URL pública (Cloudflare Worker CDN)
  const newPhotoUrl = `https://golf-cdn.misterpotatolightyear.workers.dev/${fileName}`;

  // 4. Persistir en Firestore
  await setDoc(getUserProfileRef(db, user), {
    photo_url: newPhotoUrl
  }, { merge: true });

  // 5. Actualizar estado local
  setUser({ ...user, photo_url: newPhotoUrl });
  setPhotoVersion(Date.now()); // Force refresh de imagen
}
```

**Configuración Cloudflare R2** (líneas 37-53):
```javascript
const R2_CONFIG = {
  accessKeyId: "453a6e48294058bb766317b31c742af8",
  secretAccessKey: "c4bc610a94cd5c1c18db535a1610f83df61a93836feea811999a6c4fa171ac7b",
  endpoint: "https://1e8f9eaa8024f1354556923930ad0acb.r2.cloudflarestorage.com",
  bucketName: "golf-profiles-bucket",
  publicUrl: "https://golf-cdn.misterpotatolightyear.workers.dev"
};
```

---

## Configuración Firebase

### Archivo: `src/firebase.js`

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "golf-tracker-xxxxx",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Emuladores (solo desarrollo)
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

### Reglas de Seguridad Firestore (PENDIENTE)

```javascript
// firestore.rules (estado objetivo)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Usuarios solo pueden leer/escribir su propio perfil
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid;

      // Subcolecciones privadas
      match /{subcollection}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }

    // Mapping usernames (solo lectura para autenticados)
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow write: if false; // Solo via admin SDK
    }

    // Torneos oficiales (lectura pública)
    match /tournaments/{tournamentId} {
      allow read: if true;
      allow write: if false; // Solo admins
    }
  }
}
```

**⚠️ IMPORTANTE**: Actualmente las reglas están en modo permisivo para desarrollo. Deben endurecerse antes de producción final.

---

## APIs y Servicios

### APIs PHP Legacy (Directorio: `public/api/`)

#### 1. `get_handicap.php`
**Estado**: ACTIVO (necesario para scraping RFEG)

**Función**: Scraping del hándicap oficial desde la web de RFEG

**Parámetros**:
- `username` (string): Username del jugador
- `license` (string, opcional): Nº licencia federativa (ej: CB00123456)
- `t` (timestamp, opcional): Cache buster

**Respuesta**:
```json
{
  "handicap": "12.5",
  "pdf_url": "https://...",
  "error": null
}
```

**Lógica**:
1. Buscar jugador en base de datos local por username
2. Si tiene `federation_id`, usarlo; si no, inferir de nombre
3. Hacer petición a RFEG con Puppeteer/cURL
4. Parsear HTML y extraer hándicap
5. Intentar obtener URL del PDF del historial
6. Cachear resultado en servidor (opcional)

#### 2. `get_handicap_history_pdf.php`
**Estado**: ACTIVO

**Función**: Descargar PDF del historial de hándicap desde RFEG

**Parámetros**:
- `license` (string): Nº licencia federativa

**Respuesta**: Stream del PDF o JSON con error

#### 3. `save_handicap_history.php`
**Estado**: ACTIVO

**Función**: Guardar PDF del historial en servidor (backup)

#### 4. APIs Obsoletas (ELIMINAR tras validación)
- `login.php` - Ya no se usa (Firebase Auth)
- `create_user.php` - Ya no se usa (Firestore)
- `update_user.php` - Ya no se usa (Firestore)
- `save_results.php` - Ya no se usa (Firestore)
- `save_preferences.php` - Ya no se usa (Firestore)
- `save_custom_tournaments.php` - Ya no se usa (Firestore)
- `users.json` - Archivo estático obsoleto

### Servicios Externos

#### Cloudflare R2
**Uso**: Almacenamiento de fotos de perfil

**CDN Worker**: https://golf-cdn.misterpotatolightyear.workers.dev

**Worker Code** (aproximado):
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    const object = await env.BUCKET.get(key);
    if (!object) return new Response('Not Found', { status: 404 });

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata.contentType);
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  }
}
```

#### RFEG (Real Federación Española de Golf)
**URL Base**: https://www.rfegolf.es/

**Endpoints usados** (scraping):
- Búsqueda de jugador: `/jugadores/buscar`
- Ficha de jugador: `/jugador/{id}`
- Historial PDF: `/hcp/historial/{license}.pdf` (aproximado)

**Notas**:
- Requiere scraping porque no hay API pública
- Estructura HTML puede cambiar (mantener scripts actualizados)
- Rate limiting: no hacer más de 1 petición/segundo

---

## Componentes React Principales

### Estructura de carpetas

```
src/
├── App.jsx                          # Componente raíz, routing, auth
├── components/
│   ├── CalendarView.jsx             # Vista calendario principal
│   ├── StatsView.jsx                # Estadísticas
│   ├── HandicapView.jsx             # Evolución hándicap
│   ├── LoginViewFirebase.jsx        # Pantalla login (multi mode)
│   ├── LoginView.jsx                # OBSOLETO (login PHP)
│   ├── MobileScorecardEditor.jsx    # Editor resultados móvil
│   ├── PublicScorecardView.jsx      # Vista pública compartible
│   ├── TeamLiveScorecard.jsx        # Scorecard equipo en vivo
│   ├── ResultsView.jsx              # Vista de resultados
│   ├── CalendarFilters.jsx          # Filtros de torneos
│   └── MonthGridView.jsx            # Vista mes (grid)
├── utils/
│   └── userProfiles.js              # Helpers Firebase
├── data/
│   └── tournaments.json             # Torneos estáticos (fallback)
└── firebase.js                      # Config Firebase
```

### `App.jsx` - Componente Principal

**Responsabilidades**:
1. Gestión de autenticación (onAuthStateChanged)
2. Estado global (user, results, tournaments, preferences, handicap)
3. Routing (React Router)
4. Sincronización Firestore (onSnapshot)
5. PWA updates (service worker)
6. Gestión de cache (localStorage)

**Estado principal**:
```javascript
const [user, setUser] = useState(null);                  // Usuario activo
const [linkedUsers, setLinkedUsers] = useState([]);      // Cuentas enlazadas
const [handicap, setHandicap] = useState(null);          // Hándicap actual
const [pdfUrl, setPdfUrl] = useState(null);              // URL PDF historial
const [results, setResults] = useState({});              // Resultados indexados por ID
const [customTournaments, setCustomTournaments] = useState([]); // Torneos personalizados
const [preferences, setPreferences] = useState({...});   // Preferencias usuario
const [baseTournaments, setBaseTournaments] = useState([]); // Torneos oficiales
```

**Sincronizaciones Firestore** (useEffect líneas 637-790):
```javascript
// 1. Torneos oficiales
useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, "tournaments"), (snapshot) => {
    setBaseTournaments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
  return () => unsubscribe();
}, []);

// 2. Datos del usuario activo
useEffect(() => {
  if (!user?.username) return;

  // Preferencias
  const unsubPrefs = onSnapshot(
    getUserSubdocRef(db, user, "settings", "preferences"),
    (doc) => setPreferences(doc.data() || DEFAULT_PREFERENCES)
  );

  // Resultados
  const unsubResults = onSnapshot(
    getUserSubcollectionRef(db, user, "results"),
    (snapshot) => {
      const newResults = {};
      snapshot.forEach(doc => { newResults[doc.id] = doc.data(); });
      setResults(newResults);
    }
  );

  // Torneos personalizados
  const unsubCustom = onSnapshot(
    getUserSubcollectionRef(db, user, "custom_tournaments"),
    (snapshot) => setCustomTournaments(snapshot.docs.map(doc => ({...})))
  );

  return () => {
    unsubPrefs();
    unsubResults();
    unsubCustom();
  };
}, [user?.username]);

// 3. Perfil en tiempo real (para detectar cambios de foto, managed_users, etc.)
useEffect(() => {
  if (!user?.username) return;

  const unsubProfile = onSnapshot(getUserProfileRef(db, user), (snapshot) => {
    if (snapshot.exists()) {
      const freshData = snapshot.data();
      setUser(prev => ({ ...prev, ...freshData }));
      // Actualizar linkedUsers si managed_users cambió
    }
  });

  return () => unsubProfile();
}, [user?.username]);
```

### `LoginViewFirebase.jsx`

**Pantalla de login para modo multi-usuario**

**Funcionalidades**:
- Email/Password login
- Registro de nuevos usuarios
- Recuperación de contraseña
- Validación de formularios

**Código crítico**:
```javascript
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

async function handleLogin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    onLogin(userCredential.user); // Callback a App.jsx
  } catch (error) {
    console.error('Login error:', error.code);
    // Manejar errores (auth/wrong-password, auth/user-not-found, etc.)
  }
}
```

### `CalendarView.jsx`

**Vista principal de torneos**

**Props recibidos**:
```javascript
CalendarView.propTypes = {
  tournaments: PropTypes.array,       // Lista de torneos
  results: PropTypes.object,          // { [tournamentId]: resultData }
  user: PropTypes.object,             // Usuario activo
  activeGroups: PropTypes.array,      // Grupos visibles
  hiddenGroups: PropTypes.array,      // Grupos ocultos
  customThemes: PropTypes.object,     // Temas personalizados
  onUpdateResults: PropTypes.func,    // Callback guardar resultado
  onSaveSpecificResult: PropTypes.func,
  onDeleteResult: PropTypes.func,
  onDeleteTournament: PropTypes.func,
  onAddTournament: PropTypes.func,
  onUpdateTournament: PropTypes.func,
  onUpdateGroups: PropTypes.func,
  onUpdateTheme: PropTypes.func,
  managedUsers: PropTypes.array       // Para manager mode
};
```

**Modos de visualización**:
1. **Calendar**: Vista mensual con torneos agrupados
2. **List**: Lista cronológica
3. **Grid**: Cuadrícula

**Lógica de filtrado**:
```javascript
const filteredTournaments = tournaments.filter(t => {
  // Filtrar por grupos activos
  if (!activeGroups.includes(t.organization?.toLowerCase())) return false;

  // Filtrar grupos ocultos (ej: txell no ve 'merit')
  if (hiddenGroups.includes(t.type)) return false;

  // Filtrar por búsqueda
  if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

  return true;
});
```

### `MobileScorecardEditor.jsx`

**Editor optimizado para móvil**

**Características**:
- Input hoyo por hoyo (score, putts, fairway, GIR)
- Cálculo automático de totales
- Validación (score >= par - 2, máx 10)
- Guardado offline-first
- Compartir resultado (URL pública)

**Generación URL compartida**:
```javascript
function generateShareUrl(username, tournamentId) {
  const baseUrl = window.location.origin + import.meta.env.BASE_URL;
  return `${baseUrl}live/${username}/${tournamentId}`;
}
```

### `PublicScorecardView.jsx`

**Vista pública de resultados** (sin login)

**Ruta**: `/live/:username/:id`

**Lógica**:
```javascript
import { useParams } from 'react-router-dom';

function PublicScorecardView() {
  const { username, id } = useParams();
  const [result, setResult] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function fetchData() {
      // 1. Obtener perfil por username
      const userProfile = await fetchUserProfileByUsername(db, username);
      setProfile(userProfile);

      // 2. Obtener resultado específico
      const resultDoc = await getDoc(
        getUserSubdocRef(db, userProfile, "results", id)
      );
      setResult(resultDoc.data());
    }
    fetchData();
  }, [username, id]);

  // Renderizar scorecard sin controles de edición
}
```

**⚠️ SEGURIDAD**: Esta vista es pública (no requiere auth). Asegurarse de que las reglas Firestore permitan lectura pública de `users/{uid}/results/{id}` o implementar token de compartición.

### `StatsView.jsx`

**Vista de estadísticas**

**Métricas mostradas**:
- Promedio de score (bruto y neto)
- Mejor/peor resultado
- Torneos jugados
- Gráfico de evolución (Chart.js)
- Análisis por curso
- Stats de fairways, greens, putts

**Código gráfico**:
```javascript
import { Line } from 'react-chartjs-2';

const chartData = {
  labels: tournaments.map(t => t.name),
  datasets: [{
    label: 'Score Neto',
    data: tournaments.map(t => results[t.id]?.net || null),
    borderColor: 'rgb(75, 192, 192)',
    tension: 0.1
  }]
};

<Line data={chartData} options={chartOptions} />
```

### `HandicapView.jsx`

**Vista de evolución de hándicap**

**Características**:
- Historial de hándicaps
- Gráfico de evolución
- Predicción de tendencia
- Enlace a PDF oficial

---

## Sistema de Hándicap

### Flujo Completo

```
┌──────────────┐
│ Usuario hace │
│ clic "Actua- │
│ lizar Hándi" │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ refreshHandicap()    │
│ (App.jsx:858)        │
└──────┬───────────────┘
       │
       ├─► [Cache fresco?] ─YES─► Usar cache local
       │                            │
       NO                           │
       │                            │
       ▼                            │
┌──────────────────────┐           │
│ Llamar API PHP       │           │
│ get_handicap.php     │           │
└──────┬───────────────┘           │
       │                            │
       ▼                            │
┌──────────────────────┐           │
│ PHP: Scraping RFEG   │           │
│ con Puppeteer/cURL   │           │
└──────┬───────────────┘           │
       │                            │
       ▼                            │
┌──────────────────────┐           │
│ Parsear HTML         │           │
│ Extraer hándicap     │           │
│ Obtener URL PDF      │           │
└──────┬───────────────┘           │
       │                            │
       ▼                            │
┌──────────────────────┐           │
│ Respuesta JSON       │           │
│ { handicap, pdf_url }│           │
└──────┬───────────────┘           │
       │                            │
       ▼                            │
┌──────────────────────┐           │
│ Guardar en:          │           │
│ 1. localStorage      │           │
│ 2. Firestore user    │◄──────────┘
│ 3. Estado React      │
└──────────────────────┘
```

### Implementación del Scraping (PHP)

**Archivo**: `public/api/get_handicap.php`

**Pseudocódigo**:
```php
<?php
header('Content-Type: application/json');

$username = $_GET['username'] ?? null;
$license = $_GET['license'] ?? null;

// 1. Cargar datos del usuario
$users = json_decode(file_get_contents('users.json'), true);
$user = $users[$username] ?? null;

// 2. Determinar nº licencia
$licenseId = $license ?? $user['federation_id'] ?? null;

if (!$licenseId) {
  echo json_encode(['error' => 'No se encontró licencia federativa']);
  exit;
}

// 3. Hacer scraping de RFEG
try {
  // Opción A: Puppeteer (JS subprocess)
  $command = "node scripts/fetch_handicap.cjs " . escapeshellarg($licenseId);
  $output = shell_exec($command);
  $data = json_decode($output, true);

  // Opción B: cURL directo (más rápido pero menos confiable)
  $html = file_get_contents("https://www.rfegolf.es/jugador/{$licenseId}");
  preg_match('/Hándicap:\s*([0-9.,]+)/i', $html, $matches);
  $handicap = $matches[1] ?? null;

  // 4. Buscar URL del PDF
  preg_match('/href="([^"]*historial[^"]*\.pdf)"/', $html, $pdfMatches);
  $pdfUrl = $pdfMatches[1] ?? null;

  // 5. Cachear resultado (opcional)
  $cache = [
    'handicap' => $handicap,
    'pdf_url' => $pdfUrl,
    'fetched_at' => time()
  ];
  file_put_contents("cache/handicap_{$username}.json", json_encode($cache));

  // 6. Respuesta
  echo json_encode($cache);

} catch (Exception $e) {
  echo json_encode([
    'error' => 'Error al obtener hándicap: ' . $e->getMessage(),
    'handicap' => null,
    'pdf_url' => null
  ]);
}
?>
```

**Script Node.js** (`scripts/fetch_handicap.cjs`):
```javascript
const puppeteer = require('puppeteer');

async function fetchHandicap(licenseId) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`https://www.rfegolf.es/jugador/${licenseId}`, {
    waitUntil: 'networkidle2'
  });

  // Extraer hándicap
  const handicap = await page.$eval('.handicap-value', el => el.textContent.trim());

  // Extraer URL PDF
  const pdfUrl = await page.$eval('a[href*="historial"]', el => el.href);

  await browser.close();

  return { handicap, pdf_url: pdfUrl };
}

const licenseId = process.argv[2];
fetchHandicap(licenseId).then(data => {
  console.log(JSON.stringify(data));
}).catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
```

### Lógica de Cache

**Funciones** (App.jsx líneas 97-146):

```javascript
// 1. Leer cache de localStorage
function readHandicapCache(userLike) {
  const cacheKey = `golf_tracker_handicap_cache_${getUserDocId(userLike)}`;
  try {
    return JSON.parse(localStorage.getItem(cacheKey) || 'null');
  } catch {
    return null;
  }
}

// 2. Escribir cache
function writeHandicapCache(userLike, payload) {
  const cacheKey = `golf_tracker_handicap_cache_${getUserDocId(userLike)}`;
  localStorage.setItem(cacheKey, JSON.stringify(payload));
}

// 3. Verificar si cache es fresco
function isHandicapCacheFresh(fetchedAtValue) {
  const fetchedAt = normalizeTimestamp(fetchedAtValue);
  const now = new Date();
  const todayAtEight = new Date(now);
  todayAtEight.setHours(8, 0, 0, 0);

  if (now < todayAtEight) {
    // Si aún no son las 08:00, cache válido si es de hoy (00:00)
    return fetchedAt >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  // Si ya pasaron las 08:00, cache válido si fue actualizado después de las 08:00
  return fetchedAt >= todayAtEight.getTime();
}
```

**Estrategia**:
- Cache válido desde las 08:00 AM del día actual
- Antes de las 08:00, cache válido si es del mismo día (00:00)
- Auto-actualización diaria a las 08:00 (cuando RFEG actualiza datos)

---

## Manager Mode

### Concepto

Permite que un usuario (manager) gestione múltiples perfiles, típicamente un padre gestionando cuentas de hijos menores.

### Configuración

**En Firestore**:
```javascript
// Perfil del manager (ej: david)
users/uid_david {
  username: "david",
  managed_users: ["maria", "sofia"],
  role: "manager"
}

// Perfiles gestionados NO tienen campo especial
users/uid_maria {
  username: "maria",
  // No hay referencia inversa al manager
}
```

**En estado local**:
```javascript
// Usuario activo (puede ser el manager o un gestionado)
const user = {
  username: "maria",
  uid: "uid_maria",
  manager_id: "david" // Solo si está siendo gestionado
};

// Lista de perfiles enlazados
const linkedUsers = [
  { username: "david", uid: "uid_david", ... },  // El manager
  { username: "maria", uid: "uid_maria", ... },
  { username: "sofia", uid: "uid_sofia", ... }
];
```

### Flujo de Cambio de Usuario

```javascript
// App.jsx líneas 1088-1094
function handleSwitchUser(targetUser) {
  // Preservar manager_id del contexto actual
  const newActiveUser = {
    ...targetUser,
    manager_id: user.manager_id || user.username
  };

  setUser(newActiveUser);
  localStorage.setItem('golf_tracker_user', JSON.stringify(newActiveUser));

  // Los listeners de Firestore se actualizan automáticamente
  // porque dependen de user.username
}
```

### UI de Selección

**Header con avatares** (App.jsx líneas 1163-1200):
```jsx
{linkedUsers.length > 0 && (
  <div style={{ display: 'flex', gap: '10px' }}>
    {/* Usuario activo (grande) */}
    <img
      src={getPhotoUrl(user.photo_url, user.full_name)}
      style={{ width: '80px', height: '80px', border: '3px solid primary' }}
    />

    {/* Otros usuarios (pequeños, clicables) */}
    {linkedUsers.filter(u => u.username !== user.username).map(u => (
      <img
        key={u.username}
        src={getPhotoUrl(u.photo_url, u.full_name)}
        onClick={() => handleSwitchUser(u)}
        style={{ width: '50px', height: '50px', cursor: 'pointer', opacity: 0.6 }}
      />
    ))}
  </div>
)}
```

### Persistencia de Selección

Al recargar la app, se intenta restaurar el último usuario activo:

```javascript
// App.jsx líneas 433-456
const savedActiveUser = JSON.parse(localStorage.getItem('golf_tracker_user') || 'null');

const managedProfiles = await loadManagedProfiles(ownerProfile);

if (managedProfiles.length > 0) {
  // Si había un usuario gestionado activo previamente, restaurarlo
  const preferredManagedUser = savedActiveUser?.manager_id === ownerProfile.username
    ? managedProfiles.find(p => p.username === savedActiveUser.username)
    : null;

  const firstManagedUser = managedProfiles.find(p =>
    ownerProfile.managed_users.includes(p.username)
  );

  activeUser = preferredManagedUser || firstManagedUser || ownerProfile;
}
```

---

## PWA y Service Workers

### Configuración

**Archivo**: `vite.config.js`

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
              }
            }
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      manifest: {
        name: 'Golf Tracker',
        short_name: 'Golf',
        description: 'Calendario y seguimiento de torneos de golf',
        theme_color: '#0ea5e9',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
```

### Gestión de Actualizaciones

**En App.jsx** (líneas 152-194):

```javascript
import { useRegisterSW } from 'virtual:pwa-register/react';

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegistered(registration) {
    // 1. Check periódico cada 10 minutos
    setInterval(() => {
      registration.update().catch(() => {});
    }, 10 * 60 * 1000);

    // 2. Check al volver al foreground (crítico para iOS PWA)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {});
      }
    });
  }
});

// 3. Auto-reload cuando nuevo SW toma control
useEffect(() => {
  const handleControllerChange = () => {
    console.log('New SW controller detected, reloading…');
    window.location.reload();
  };
  navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);
  return () => {
    navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
  };
}, []);

// 4. Banner de actualización
{needRefresh && (
  <div style={{ position: 'fixed', bottom: '30px', ... }}>
    <p>Nueva versión disponible</p>
    <button onClick={() => updateServiceWorker(true)}>ACTUALIZAR</button>
  </div>
)}
```

**Estrategias**:
1. **autoUpdate**: SW nuevo se instala automáticamente y llama skipWaiting()
2. **controllerchange**: Recargar página cuando nuevo SW toma control
3. **visibilitychange**: Forzar check al volver de background (iOS)

### Offline-First

**Firestore Offline Persistence** (habilitado por defecto en Firebase v9+):
```javascript
// En firebase.js (implícito)
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const db = getFirestore(app);

// Opcional: habilitar persistencia explícita
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support persistence
  }
});
```

**Ventajas**:
- Lecturas funcionan offline (datos cacheados en IndexedDB)
- Escrituras se quedan pendientes y se sincronizan al reconectar
- onSnapshot recibe datos locales inmediatamente

---

## Scripts de Migración

### `scripts/migrate_users_to_firebase.js`

**Propósito**: Migrar usuarios de PHP/JSON a Firebase Authentication

**Uso**:
```bash
node scripts/migrate_users_to_firebase.js
```

**Lógica**:
```javascript
import { auth, db } from '../src/firebase.js';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import credentials from '../MIGRATION_CREDENTIALS.json';

for (const user of credentials.users) {
  try {
    // 1. Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      user.email,
      user.password
    );

    const uid = userCredential.user.uid;

    // 2. Crear documento en Firestore
    await setDoc(doc(db, 'users', uid), {
      username: user.username,
      uid: uid,
      email: user.email,
      full_name: user.full_name,
      federation_id: user.federation_id || null,
      photo_url: user.photo_url || null,
      created_at: new Date().toISOString()
    });

    // 3. Crear mapping username -> uid
    await setDoc(doc(db, 'usernames', user.username), {
      uid: uid,
      username: user.username,
      updated_at: new Date().toISOString()
    });

    console.log(`✅ Migrado: ${user.username}`);

  } catch (error) {
    console.error(`❌ Error migrando ${user.username}:`, error.code);
  }
}
```

**Archivo**: `MIGRATION_CREDENTIALS.json`
```json
{
  "users": [
    {
      "username": "nicole",
      "email": "nicole@golfteam.app",
      "password": "temporal123",
      "full_name": "Nicole Likhomanova",
      "federation_id": "CB00123456"
    },
    {
      "username": "david",
      "email": "david@golfteam.app",
      "password": "temporal123",
      "full_name": "David Manager",
      "managed_users": ["maria", "sofia"]
    }
  ]
}
```

### `scripts/migrate_user_ownership_to_uid.js`

**Propósito**: Migrar estructura de datos de `usernames/{username}` a `users/{uid}`

**Uso**:
```bash
node scripts/migrate_user_ownership_to_uid.js
```

**Lógica**:
```javascript
import { db } from '../src/firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

// 1. Obtener todos los usuarios
const usersSnapshot = await getDocs(collection(db, 'users'));

for (const userDoc of usersSnapshot.docs) {
  const uid = userDoc.id;
  const userData = userDoc.data();
  const username = userData.username;

  console.log(`Migrando datos de ${username} (${uid})...`);

  // 2. Migrar resultados de usernames/{username}/results a users/{uid}/results
  const oldResultsRef = collection(db, 'usernames', username, 'results');
  const resultsSnapshot = await getDocs(oldResultsRef);

  for (const resultDoc of resultsSnapshot.docs) {
    const resultData = resultDoc.data();
    await setDoc(doc(db, 'users', uid, 'results', resultDoc.id), resultData);
    await deleteDoc(resultDoc.ref); // Limpiar dato viejo
  }

  // 3. Migrar custom_tournaments
  const oldCustomRef = collection(db, 'usernames', username, 'custom_tournaments');
  const customSnapshot = await getDocs(oldCustomRef);

  for (const customDoc of customSnapshot.docs) {
    const customData = customDoc.data();
    await setDoc(doc(db, 'users', uid, 'custom_tournaments', customDoc.id), customData);
    await deleteDoc(customDoc.ref);
  }

  // 4. Migrar preferences
  const oldPrefsDoc = await getDoc(doc(db, 'usernames', username, 'settings', 'preferences'));
  if (oldPrefsDoc.exists()) {
    await setDoc(doc(db, 'users', uid, 'settings', 'preferences'), oldPrefsDoc.data());
    await deleteDoc(oldPrefsDoc.ref);
  }

  console.log(`✅ ${username} migrado completamente`);
}
```

### `scripts/migrate_txell_to_firebase.js`

**Propósito**: Migración manual de usuario específico (txell) con password válida

**Contexto**: Firebase requiere passwords mínimo 6 caracteres; usuarios antiguos tenían passwords más cortas.

---

## Estado Actual y TODOs

### ✅ Completado

- [x] Configuración Firebase (Auth + Firestore)
- [x] Componente LoginViewFirebase
- [x] Scripts de migración de usuarios
- [x] Migración de ownership a UID
- [x] Mapping usernames → uid
- [x] Sustitución de login PHP por Firebase
- [x] Sesión con onAuthStateChanged
- [x] Compatibilidad con perfiles legacy
- [x] Manager mode funcional
- [x] Vistas públicas adaptadas
- [x] Sistema de hándicap con cache
- [x] Optimización UX (cache + background refresh)
- [x] Deploy en producción (https://reinaldomoon.top/GolfTeam/)
- [x] Alinear repo GitHub con producción (commit 10ed289)

### ⚠️ Pendiente (Crítico)

#### 1. Testing Funcional
```
[ ] Probar login con nicole, txell, david
[ ] Validar perfil cargado correctamente tras login
[ ] Validar manager mode (david cambiando entre maria y sofia)
[ ] Validar guardado de resultados (crear, editar, eliminar)
[ ] Validar torneos personalizados (crear, editar, eliminar)
[ ] Validar subida de foto de perfil
[ ] Validar logout y re-login
[ ] Validar flujo de hándicap para 2+ usuarios
```

#### 2. Limpieza de Código Legacy
```
[ ] Decidir endpoints PHP necesarios vs obsoletos
[ ] Mantener temporalmente:
    - public/api/get_handicap.php
    - public/api/get_handicap_history_pdf.php
    - public/api/save_handicap_history.php
[ ] Eliminar tras validación:
    - public/api/login.php
    - public/api/create_user.php
    - public/api/update_user.php
    - public/api/save_results.php
    - public/api/save_preferences.php
    - public/api/save_custom_tournaments.php
    - public/api/users.json
    - src/components/LoginView.jsx
```

#### 3. Seguridad Firestore
```
[ ] Revisar reglas actuales en Firebase Console
[ ] Implementar reglas restrictivas (ver sección "Configuración Firebase")
[ ] Confirmar acceso solo a users/{request.auth.uid}
[ ] Definir modelo de acceso para manager mode
[ ] Proteger usernames (solo lectura autenticada)
[ ] Proteger tournaments (lectura pública, escritura admin)
```

#### 4. Optimizaciones
```
[ ] Refactorizar handleUpdateResults para evitar bulk writes
[ ] Implementar handleSaveSpecificResult en CalendarView
[ ] Añadir índices Firestore para queries frecuentes
[ ] Comprimir imágenes antes de subir a R2
[ ] Lazy loading de componentes pesados
```

#### 5. Deploy Futuro
```
[ ] Evaluar migración a Vercel/Netlify
[ ] Configurar variables de entorno en plataforma
[ ] Configurar dominio personalizado
[ ] SSL automático
```

### 📋 Backlog (No crítico)

- [ ] Modo TypeScript (mejorar type safety)
- [ ] Tests unitarios (Vitest)
- [ ] Tests E2E (Playwright)
- [ ] Internacionalización (i18n para catalán/español/inglés)
- [ ] Modo oscuro
- [ ] Notificaciones push (recordatorios de torneos)
- [ ] Exportar estadísticas a PDF/CSV
- [ ] Comparación entre jugadores (gráficos comparativos)
- [ ] Integración con calendario del sistema (iOS/Android)

---

## Guías de Desarrollo

### Setup Inicial

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd Players\ Calendar

# 2. Instalar dependencias
npm install

# 3. Configurar Firebase
# Crear archivo src/firebase.js con credenciales

# 4. Configurar variables de entorno
# Crear .env.local
VITE_APP_MODE=multi
VITE_BASE_URL=/

# 5. Ejecutar en desarrollo
npm run dev

# 6. Build para producción
npm run build

# 7. Preview build
npm run preview
```

### Comandos Útiles

```bash
# Desarrollo
npm run dev                    # Dev server (puerto 5173)

# Build
npm run build                  # Build producción
npm run preview                # Preview build local

# Linting
npm run lint                   # ESLint

# Scripts Firebase
node scripts/migrate_users_to_firebase.js
node scripts/migrate_user_ownership_to_uid.js
node scripts/list_users.js     # Listar usuarios Firestore

# Deploy (FTP)
# Configurar en deploy_config.js
npm run deploy                 # Si existe script
```

### Agregar Nuevo Usuario

**Opción 1: Via interfaz (recomendado)**
1. Ir a `/` en modo multi
2. Hacer clic en "Registrarse"
3. Completar formulario

**Opción 2: Via script**
```javascript
// En Firebase Console > Authentication > Add User
// O usar script:

import { auth, db } from './src/firebase.js';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';

const newUser = {
  email: 'nuevo@example.com',
  password: 'password123',
  username: 'nuevo',
  full_name: 'Nuevo Jugador'
};

const userCredential = await createUserWithEmailAndPassword(
  auth,
  newUser.email,
  newUser.password
);

await setDoc(doc(db, 'users', userCredential.user.uid), {
  username: newUser.username,
  uid: userCredential.user.uid,
  email: newUser.email,
  full_name: newUser.full_name,
  created_at: new Date().toISOString()
});

await setDoc(doc(db, 'usernames', newUser.username), {
  uid: userCredential.user.uid,
  username: newUser.username
});
```

### Agregar Torneo Oficial

```javascript
// En Firebase Console > Firestore > tournaments
// O programáticamente:

import { db } from './src/firebase.js';
import { setDoc, doc } from 'firebase/firestore';

const tournament = {
  id: 200, // Debe ser único
  name: "Campeonato Regional",
  dates: "25/04/2026 - 26/04/2026",
  location: "Golf Costa Daurada",
  organization: "FCG",
  category: "Juvenil",
  type: "strokeplay",
  details: "36 hoyos stroke play",
  official: true
};

await setDoc(doc(db, 'tournaments', String(tournament.id)), tournament);
```

### Debugging

**Firebase Emulators** (opcional para testing local):
```bash
# Instalar CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar proyecto
firebase init emulators

# Ejecutar emuladores
firebase emulators:start

# En .env.local
VITE_USE_EMULATORS=true
```

**Logs útiles**:
```javascript
// Ver datos en consola
window.debugUser = () => console.log(JSON.parse(localStorage.getItem('golf_tracker_user')));
window.debugCache = (username) => console.log(JSON.parse(localStorage.getItem(`golf_tracker_handicap_cache_${username}`)));
window.debugLinked = () => console.log(JSON.parse(localStorage.getItem('golf_tracker_linked_users')));

// Borrar todos los datos de un usuario (solo Sofia por defecto)
window.nukeUserData(); // Definido en App.jsx línea 219
```

**Cloudflare R2 Debug**:
```bash
# Listar objetos
aws s3 ls s3://golf-profiles-bucket --endpoint-url=https://1e8f9eaa8024f1354556923930ad0acb.r2.cloudflarestorage.com

# Subir manual
aws s3 cp test.jpg s3://golf-profiles-bucket/test.jpg --endpoint-url=...
```

### Convenciones de Código

**Estructura de componentes**:
```javascript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';

// 2. Helpers/Utils (fuera del componente)
function helperFunction() { ... }

// 3. Componente principal
function MyComponent({ prop1, prop2 }) {
  // 3.1. State
  const [data, setData] = useState(null);

  // 3.2. Effects
  useEffect(() => { ... }, []);

  // 3.3. Handlers
  const handleClick = () => { ... };

  // 3.4. Render
  return (
    <div>...</div>
  );
}

// 4. PropTypes (opcional pero recomendado)
MyComponent.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.func
};

// 5. Export
export default MyComponent;
```

**Naming**:
- Componentes: PascalCase (`CalendarView.jsx`)
- Funciones/variables: camelCase (`handleUpdateResults`)
- Constantes: UPPER_SNAKE_CASE (`DEFAULT_PREFERENCES`)
- Archivos utils: camelCase (`userProfiles.js`)
- CSS classes: kebab-case (`app-container`)

**Firestore paths**:
- Colecciones: plural snake_case (`custom_tournaments`)
- Documentos: IDs únicos (uid, username, tournamentId)
- Subcolecciones: singular snake_case (`settings`)

### Git Workflow

```bash
# Feature branch
git checkout -b feature/nueva-funcionalidad

# Commits descriptivos
git commit -m "feat: añadir filtro de torneos por fecha"
git commit -m "fix: corregir cache de hándicap"
git commit -m "refactor: extraer lógica de auth a hook"

# Push
git push origin feature/nueva-funcionalidad

# Merge a main
git checkout main
git merge feature/nueva-funcionalidad
git push origin main

# Tag de versión
git tag -a v2.5.0 -m "Release 2.5.0"
git push origin v2.5.0
```

---

## Apéndices

### A. Glosario de Términos de Golf

- **Hándicap**: Sistema de igualación que permite a jugadores de diferentes niveles competir equitativamente
- **Par**: Número de golpes que un jugador experto debería necesitar para completar un hoyo
- **Stroke Play**: Modalidad donde gana quien completa el recorrido en menos golpes
- **Match Play**: Modalidad donde se compite hoyo por hoyo
- **GIR (Green in Regulation)**: Alcanzar el green en par - 2 golpes
- **Fairway**: Área de hierba corta entre tee y green
- **Putts**: Golpes realizados en el green
- **Gross**: Resultado bruto (sin aplicar hándicap)
- **Net**: Resultado neto (aplicando hándicap)
- **RFEG**: Real Federación Española de Golf
- **FCG**: Federación Catalana de Golf

### B. Estructura de Archivos Completa

```
Players Calendar/
├── public/
│   ├── api/                  # APIs PHP legacy
│   │   ├── get_handicap.php
│   │   ├── get_handicap_history_pdf.php
│   │   ├── save_handicap_history.php
│   │   ├── login.php (OBSOLETO)
│   │   ├── create_user.php (OBSOLETO)
│   │   └── ...
│   ├── profiles/             # Fotos antiguas (migradas a R2)
│   ├── icon-192.png
│   ├── icon-512.png
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── CalendarView.jsx
│   │   ├── StatsView.jsx
│   │   ├── HandicapView.jsx
│   │   ├── LoginViewFirebase.jsx
│   │   ├── MobileScorecardEditor.jsx
│   │   ├── PublicScorecardView.jsx
│   │   ├── TeamLiveScorecard.jsx
│   │   ├── ResultsView.jsx
│   │   ├── CalendarFilters.jsx
│   │   └── MonthGridView.jsx
│   ├── data/
│   │   └── tournaments.json
│   ├── utils/
│   │   └── userProfiles.js
│   ├── App.jsx
│   ├── main.jsx
│   ├── firebase.js
│   └── index.css
├── scripts/
│   ├── migrate_users_to_firebase.js
│   ├── migrate_user_ownership_to_uid.js
│   ├── migrate_txell_to_firebase.js
│   ├── fetch_handicap.cjs
│   ├── scrape_rfeg.cjs
│   └── ...
├── .gitignore
├── package.json
├── vite.config.js
├── eslint.config.js
├── index.html
├── PASOS_MIGRACION_FIREBASE.md
├── CREDENCIALES_USUARIOS_FIREBASE.txt
├── MIGRATION_CREDENTIALS.json
└── DOCUMENTACION_TECNICA.md (este archivo)
```

### C. URLs y Enlaces

- **Producción**: https://reinaldomoon.top/GolfTeam/
- **Repositorio**: GitHub (privado)
- **Firebase Console**: https://console.firebase.google.com/
- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **RFEG Web**: https://www.rfegolf.es/
- **FCG Web**: https://www.fcgolf.cat/

### D. Contacto y Soporte

**Desarrollador**: Reinaldo Moon
**Email**: misterpotatolightyear@gmail.com
**Usuarios principales**: Nicole, David, María, Sofía, Txell

---

## Changelog

### v2.4.8 (2026-03-16) - Actual
- Migración completa a Firebase
- Cache de hándicap optimizado
- Manager mode funcional
- Sincronización en tiempo real

### v2.4.0 (2026-03-10)
- Implementación inicial de Firebase Auth
- Scripts de migración de usuarios

### v2.3.0 (2026-02-20)
- Sistema de hándicap automático
- PDF oficial de RFEG

### v2.2.0 (2026-02-01)
- Modo manager (multi-usuario)
- Fotos en Cloudflare R2

### v2.1.0 (2026-01-15)
- PWA funcional
- Service workers
- Modo offline

### v2.0.0 (2026-01-01)
- Reescritura completa en React
- Vite como bundler
- Arquitectura moderna

### v1.x (2025)
- Versión PHP legacy
- JSON como base de datos

---

**Última actualización**: 16 de marzo de 2026
**Versión del documento**: 1.0
**Mantenido por**: Reinaldo Moon

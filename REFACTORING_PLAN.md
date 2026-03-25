# 📋 Plan Maestro de Refactorización - RoundTracker

**Fecha:** 25 de Marzo de 2026
**Versión actual:** 3.0.0
**Estado:** Análisis completo terminado
**Tiempo estimado:** 4-6 semanas

---

## 🎯 Objetivos

1. **Reducir complejidad** - De 5,000+ líneas en 2 archivos a arquitectura modular
2. **Mejorar mantenibilidad** - Separar responsabilidades, crear componentes reutilizables
3. **Incrementar testabilidad** - De 0% a 80% de cobertura potencial
4. **Seguridad** - Eliminar credenciales hardcodeadas
5. **Performance** - Optimizar re-renders innecesarios
6. **Escalabilidad** - Base sólida para nuevas features

---

## 📊 Estado Actual

### Archivos Problemáticos

| Archivo | Líneas | Tamaño | Estado | Prioridad |
|---------|--------|--------|--------|-----------|
| **CalendarView.jsx** | 3,278 | 193 KB | 🔴 CRÍTICO | P0 |
| **App.jsx** | 1,722 | 62 KB | 🔴 CRÍTICO | P0 |
| PublicScorecardView.jsx | 861 | - | 🟡 Grande | P2 |
| StatsView.jsx | 764 | - | 🟡 Grande | P2 |

### Métricas de Complejidad

| Componente | Estados | Efectos | Funciones | Nivel |
|------------|---------|---------|-----------|-------|
| CalendarView | 14 | 6 | ~50 | 🔴 Crítico |
| App | 20 | 11 | 33 | 🔴 Crítico |

### Problemas Críticos Identificados

1. ⚠️ **Credenciales de Cloudflare R2 expuestas** en App.jsx líneas 44-51
2. ⚠️ **CalendarView monolítico** - 10+ responsabilidades en un solo componente
3. ⚠️ **Prop drilling masivo** - 13 props pasadas a CalendarView
4. ⚠️ **Auto-guardado agresivo** - JSON.stringify en dependencias de useEffect
5. ⚠️ **0 tests automatizados** - Refactorización sin red de seguridad
6. ⚠️ **Código duplicado** - Lógica de routes, formularios, validaciones

---

## 🏗️ Arquitectura Objetivo

```
src/
├── config/
│   ├── cloudflare.js          ← R2 config (desde .env)
│   ├── app.js                 ← APP_MODE, defaults
│   ├── api.js                 ← Endpoints
│   └── constants.js           ← Constantes globales
│
├── services/
│   ├── auth.service.js        ← Firebase Auth
│   ├── handicap.service.js    ← Fetch + cache hándicap
│   ├── profile.service.js     ← Upload foto, update profile
│   ├── tournaments.service.js ← CRUD torneos
│   ├── results.service.js     ← CRUD resultados
│   └── preferences.service.js ← CRUD preferencias
│
├── context/
│   ├── AuthContext.jsx        ← user, sessionOwner, authReady
│   ├── DataContext.jsx        ← tournaments, results, prefs
│   └── HandicapContext.jsx    ← handicap state + operations
│
├── hooks/
│   ├── useAuth.js             ← Auth state management
│   ├── useHandicap.js         ← Handicap fetch + cache
│   ├── useTournaments.js      ← Torneos + filtering
│   ├── useResults.js          ← Results state sync
│   ├── usePreferences.js      ← Prefs persistence
│   ├── useLinkedUsers.js      ← Manager mode
│   ├── useScorecardManager.js ← Scorecard logic
│   ├── useTournamentFilters.js← Filter/group logic
│   ├── useAutoSave.js         ← Debounced save hook
│   └── useServiceWorker.js    ← PWA updates
│
├── components/
│   ├── layout/
│   │   ├── AppHeader.jsx      ← Header completo
│   │   ├── UserProfile.jsx    ← Foto + nombre
│   │   ├── NavigationTabs.jsx ← Nav tabs
│   │   └── SeasonSelector.jsx ← Selector temporada
│   │
│   ├── calendar/
│   │   ├── CalendarView.jsx            (reducido a ~300 líneas)
│   │   ├── TournamentCard.jsx          (~100 líneas)
│   │   ├── ResultRow.jsx               (~100 líneas)
│   │   ├── TournamentFilters.jsx       (~150 líneas)
│   │   ├── TournamentForm.jsx          (~200 líneas)
│   │   ├── TournamentDetailsEditor.jsx (~250 líneas)
│   │   ├── ResultsForm.jsx             (~300 líneas)
│   │   ├── ScorecardEditor.jsx         (~400 líneas)
│   │   ├── ScorecardGrid.jsx           (~200 líneas)
│   │   ├── SocialCardExporter.jsx      (~150 líneas)
│   │   └── ContextMenu.jsx             (~100 líneas)
│   │
│   ├── modals/
│   │   ├── ProfileEditModal.jsx
│   │   └── PWAUpdateBanner.jsx
│   │
│   ├── shared/
│   │   ├── DateRangePicker.jsx
│   │   ├── ConfirmDialog.jsx
│   │   └── LoadingSpinner.jsx
│   │
│   └── admin/               (ya existente, mantener)
│       └── ...
│
├── utils/
│   ├── dateHelpers.js        ← parseDateHelper, getRoundDates, etc
│   ├── scoreHelpers.js       ← Cálculos de score, stableford
│   ├── themeHelpers.js       ← Lógica de temas
│   ├── cache.js              ← localStorage helpers
│   └── validators.js         ← Validaciones reutilizables
│
├── routes/
│   └── index.jsx             ← Configuración de routes
│
└── App.jsx                   (reducido a ~150 líneas)
```

---

## 📅 Plan de Ejecución - 6 Semanas

### 🚨 SEMANA 0: Preparación (ANTES de empezar)

**Tiempo:** 1 día

#### Tareas

- [ ] **Commit de estado actual**
  ```bash
  git add .
  git commit -m "checkpoint: pre-refactoring stable state"
  git push origin main
  ```

- [ ] **Crear branch de refactorización**
  ```bash
  git checkout -b refactor/modular-architecture
  ```

- [ ] **Rotar credenciales de Cloudflare R2**
  - En Dashboard de Cloudflare → R2 → API Tokens
  - Revocar token actual: `453a6e48294058bb766317b31c742af8`
  - Generar nuevo token
  - Documentar en 1Password/bitwarden

- [ ] **Crear archivos de environment**
  ```bash
  # .env.local
  VITE_R2_ACCESS_KEY_ID=xxx
  VITE_R2_SECRET_ACCESS_KEY=xxx
  VITE_R2_ENDPOINT=https://...
  VITE_R2_BUCKET_NAME=golf-profiles-bucket
  VITE_R2_PUBLIC_URL=https://pub-23c281cf1ae04def9102341cf7d87837.r2.dev

  # .env.production (actualizar con nuevas credenciales)
  ```

- [ ] **Actualizar .gitignore**
  ```
  .env
  .env.local
  .env.*.local
  ```

- [ ] **Configurar Staging Environment** (seguir SETUP_STAGING_ENVIRONMENT.md)

---

### 📦 SEMANA 1: Infraestructura Base

**Objetivo:** Crear estructura de carpetas y archivos de configuración

#### Día 1-2: Configuración y Utilidades

**Archivos a crear:**

1. `src/config/cloudflare.js`
```javascript
import { S3Client } from "@aws-sdk/client-s3";

export const R2_CONFIG = {
  accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
  secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  bucketName: import.meta.env.VITE_R2_BUCKET_NAME,
  publicUrl: import.meta.env.VITE_R2_PUBLIC_URL
};

export const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});
```

2. `src/config/app.js`
3. `src/config/api.js`
4. `src/utils/dateHelpers.js` - Extraer de CalendarView
5. `src/utils/scoreHelpers.js` - Funciones de cálculo
6. `src/utils/cache.js` - localStorage wrappers

**Validación:**
- [ ] App compila sin errores
- [ ] Credenciales cargadas desde .env
- [ ] Tests de utils (opcional pero recomendado)

---

#### Día 3-5: Servicios Core

**Archivos a crear:**

1. `src/services/auth.service.js`
```javascript
import { auth } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';

export const authService = {
  async logout() {
    await signOut(auth);
  },

  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  getCurrentUser() {
    return auth.currentUser;
  }
};
```

2. `src/services/handicap.service.js`
3. `src/services/profile.service.js`
4. `src/services/tournaments.service.js`
5. `src/services/results.service.js`
6. `src/services/preferences.service.js`

**Validación:**
- [ ] Cada servicio exporta funciones puras
- [ ] No hay lógica de UI en servicios
- [ ] Servicios son testables sin React

**Testing:**
```bash
npm run dev
# Verificar que no hay regresiones
```

---

### 🎯 SEMANA 2: Context API y Hooks

**Objetivo:** Implementar state management con Context

#### Día 1-2: AuthContext

**Archivo:** `src/context/AuthContext.jsx`

**Estados:**
- `user`
- `sessionOwner`
- `authReady`
- `linkedUsers`

**Funciones:**
- `login`, `logout`
- `switchUser`, `returnToOwner`
- `resetSession`

**Hook:** `src/hooks/useAuth.js`

**Migración:**
```javascript
// ANTES (en componentes)
<CalendarView user={user} onLogout={handleLogout} ... />

// DESPUÉS
import { useAuth } from '../hooks/useAuth';

function CalendarView() {
  const { user, logout } = useAuth();
  // ...
}
```

**Validación:**
- [ ] Login funciona
- [ ] Logout funciona
- [ ] Switch user funciona (modo manager)
- [ ] Session persiste en reload

---

#### Día 3-4: DataContext

**Archivo:** `src/context/DataContext.jsx`

**Estados:**
- `tournaments` (computed)
- `results`
- `preferences`
- `baseTournaments`
- `customTournaments`

**Funciones:**
- `addTournament`, `updateTournament`, `deleteTournament`
- `saveResult`, `deleteResult`
- `updatePreferences`, `updateTheme`

**Hooks:**
- `src/hooks/useTournaments.js`
- `src/hooks/useResults.js`
- `src/hooks/usePreferences.js`

**Validación:**
- [ ] CRUD de torneos funciona
- [ ] Guardado de resultados funciona
- [ ] Filtrado de torneos funciona
- [ ] Preferencias se guardan

---

#### Día 5: HandicapContext + Hooks personalizados

**Archivo:** `src/context/HandicapContext.jsx`

**Otros hooks:**
- `src/hooks/useAutoSave.js` - Debounced save reutilizable
- `src/hooks/useServiceWorker.js` - PWA update logic
- `src/hooks/useLinkedUsers.js` - Manager mode

**Validación:**
- [ ] Handicap fetch funciona
- [ ] Cache funciona
- [ ] Auto-update a las 08:00 funciona

---

### 🧩 SEMANA 3: Componentes de Layout (App.jsx)

**Objetivo:** Extraer componentes de App.jsx

#### Día 1: Header y Navigation

**Componentes a crear:**

1. `src/components/layout/AppHeader.jsx`
   - Logo
   - UserProfile
   - Manager mode toggle
   - Logout button

2. `src/components/layout/UserProfile.jsx`
   - Foto de perfil
   - Nombre
   - Click handler para modal

3. `src/components/layout/NavigationTabs.jsx`
   - Tabs: Calendario, Stats, Hándicap, Admin

4. `src/components/layout/SeasonSelector.jsx`
   - Select de temporada

**Validación:**
- [ ] Header se renderiza correctamente
- [ ] Navigation funciona
- [ ] Estilos se mantienen

---

#### Día 2-3: Modales

**Componentes a crear:**

1. `src/components/modals/ProfileEditModal.jsx`
   - Formulario de edición
   - Upload de foto
   - Validación

2. `src/components/modals/PWAUpdateBanner.jsx`
   - Banner de actualización
   - Botón reload

**Validación:**
- [ ] Modal de perfil abre/cierra
- [ ] Upload de foto funciona
- [ ] Update banner aparece cuando hay update

---

#### Día 4-5: Refactorizar App.jsx

**Resultado esperado:**

```javascript
// App.jsx (~150 líneas)
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { HandicapProvider } from './context/HandicapContext';
import { AppRoutes } from './routes';
import { AppHeader } from './components/layout/AppHeader';
import { PWAUpdateBanner } from './components/modals/PWAUpdateBanner';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <HandicapProvider>
            <PWAUpdateBanner />
            <AppHeader />
            <AppRoutes />
          </HandicapProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

**Validación:**
- [ ] App.jsx < 200 líneas
- [ ] Todas las rutas funcionan
- [ ] No hay regresiones

---

### 🗓️ SEMANA 4: Componentes de Calendar (Parte 1)

**Objetivo:** Extraer componentes simples de CalendarView

#### Día 1: Cards y Rows

1. `src/components/calendar/TournamentCard.jsx`
   - Props: `tournament`, `result`, `onClick`, `onContextMenu`, `style`
   - Renderizado de tarjeta en grid

2. `src/components/calendar/ResultRow.jsx`
   - Props: `tournament`, `result`, `onClick`
   - Renderizado de fila en lista

**Validación:**
- [ ] Grid view funciona
- [ ] List view funciona
- [ ] Estilos correctos
- [ ] Click handlers funcionan

---

#### Día 2-3: Filtros y Menú

1. `src/components/calendar/TournamentFilters.jsx`
   - Botones de filtro
   - CalendarFilters integration
   - Collapse/expand

2. `src/components/calendar/ContextMenu.jsx`
   - Menu contextual
   - Copy/paste color
   - Duplicate, edit, delete

**Hook:** `src/hooks/useTournamentFilters.js`

**Validación:**
- [ ] Filtros funcionan
- [ ] Menu contextual funciona
- [ ] Long press en móvil funciona

---

#### Día 4-5: Formulario de Torneo

1. `src/components/calendar/TournamentForm.jsx`
   - Modal de creación
   - Validación de conflictos
   - Custom courses

**Validación:**
- [ ] Crear torneo funciona
- [ ] Detección de conflictos funciona
- [ ] Custom courses se guardan

---

### 🗓️ SEMANA 5: Componentes de Calendar (Parte 2)

**Objetivo:** Componentes complejos de edición

#### Día 1-2: Editor de Detalles

1. `src/components/calendar/TournamentDetailsEditor.jsx`
   - Formulario de edición
   - Auto-cálculo de par
   - Grupos toggle
   - Track putts/girs

**Validación:**
- [ ] Edición de detalles funciona
- [ ] Auto-save funciona
- [ ] Grupos se actualizan

---

#### Día 3-5: Scorecard Editor

1. `src/components/calendar/ScorecardEditor.jsx`
   - Grid de 18 hoyos
   - Auto-cálculo de totales
   - Validación de mismatches

2. `src/components/calendar/ScorecardGrid.jsx`
   - Front 9 / Back 9
   - Putts condicionales
   - GIR condicional

3. `src/components/calendar/ResultsForm.jsx`
   - Formulario de resultados
   - Integración con ScorecardEditor
   - Auto-guardado

**Hook:** `src/hooks/useScorecardManager.js`

**Validación:**
- [ ] Edición de scorecard funciona
- [ ] Totales se calculan correctamente
- [ ] Putts/GIR funcionan
- [ ] Auto-guardado funciona
- [ ] Mismatch warnings aparecen

---

### 🗓️ SEMANA 6: Finalización y Testing

**Objetivo:** Limpieza, optimización y validación completa

#### Día 1-2: Componentes restantes

1. `src/components/calendar/SocialCardExporter.jsx`
   - html2canvas integration
   - Share button

2. `src/routes/index.jsx`
   - Centralizar rutas
   - ProtectedRoute component

**Validación:**
- [ ] Compartir scorecard funciona
- [ ] Routing funciona
- [ ] Admin route protegida

---

#### Día 3-4: Refactorizar CalendarView Final

**Resultado esperado:**

```javascript
// CalendarView.jsx (~300 líneas)
import { useTournaments } from '../../hooks/useTournaments';
import { useResults } from '../../hooks/useResults';
import { TournamentCard } from './TournamentCard';
import { TournamentFilters } from './TournamentFilters';
import { TournamentForm } from './TournamentForm';
// ...

function CalendarView() {
  const { tournaments, filter, setFilter } = useTournaments();
  const { results } = useResults();

  // Lógica mínima de orquestación

  return (
    <div>
      <TournamentFilters filter={filter} onChange={setFilter} />
      {tournaments.map(t => (
        <TournamentCard key={t.id} tournament={t} result={results[t.id]} />
      ))}
      <TournamentForm />
    </div>
  );
}
```

**Validación:**
- [ ] CalendarView < 350 líneas
- [ ] Todas las features funcionan
- [ ] No hay regresiones

---

#### Día 5: Testing Manual Completo

**Checklist de Testing:**

##### Autenticación
- [ ] Login con email/password
- [ ] Logout
- [ ] Session persiste en reload
- [ ] Manager mode: switch user
- [ ] Manager mode: return to owner

##### Torneos
- [ ] Ver lista de torneos
- [ ] Filtrar por grupos
- [ ] Filtrar por upcoming/conflicts/grand_prix
- [ ] Crear torneo personalizado
- [ ] Editar torneo
- [ ] Eliminar torneo
- [ ] Detectar conflictos

##### Resultados
- [ ] Ver detalles de torneo
- [ ] Editar scorecard (18 hoyos)
- [ ] Guardar resultado
- [ ] Auto-guardado funciona
- [ ] Eliminar resultado
- [ ] Putts tracking funciona
- [ ] GIR tracking funciona
- [ ] Mismatch warnings aparecen

##### Scorecard
- [ ] Expandir/contraer scorecard
- [ ] Editar hoyo por hoyo
- [ ] Totales se calculan correctamente
- [ ] Reset card funciona
- [ ] Compartir como imagen funciona
- [ ] Modo móvil funciona

##### Hándicap
- [ ] Actualizar hándicap
- [ ] Ver PDF
- [ ] Cache funciona
- [ ] Auto-update 08:00 funciona

##### Perfil
- [ ] Editar nombre
- [ ] Editar email
- [ ] Editar licencia
- [ ] Upload foto
- [ ] Foto se muestra correctamente

##### Live Mode
- [ ] Compartir scorecard en vivo
- [ ] URL pública funciona
- [ ] Actualización en tiempo real

##### Admin
- [ ] Acceso a admin panel (si eres admin)
- [ ] Gestión de usuarios
- [ ] Feature flags
- [ ] Analytics

##### PWA
- [ ] Install prompt funciona
- [ ] Offline mode funciona
- [ ] Update banner aparece
- [ ] Reload actualiza correctamente

##### UI/UX
- [ ] Responsive en móvil
- [ ] Responsive en tablet
- [ ] Temas personalizados funcionan
- [ ] Copy/paste color funciona
- [ ] Context menu funciona
- [ ] Long press en móvil funciona

---

## 🧪 Testing Automatizado (Opcional pero Recomendado)

### Setup de Testing

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event
```

**vitest.config.js:**
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
```

### Tests Prioritarios

1. **Utils**
   - `dateHelpers.test.js` - parseDateHelper, getRoundDates
   - `scoreHelpers.test.js` - Cálculos de totales
   - `cache.test.js` - localStorage wrappers

2. **Services**
   - `handicap.service.test.js` - Fetch + cache
   - `tournaments.service.test.js` - CRUD

3. **Hooks**
   - `useAuth.test.js` - Login/logout
   - `useTournaments.test.js` - Filtering
   - `useAutoSave.test.js` - Debouncing

4. **Componentes**
   - `TournamentCard.test.jsx` - Renderizado
   - `ScorecardEditor.test.jsx` - Cálculos

**Meta:** 60-80% de cobertura en utils y servicios

---

## 📈 Métricas de Éxito

### Antes de Refactorización

| Métrica | Valor |
|---------|-------|
| Líneas en App.jsx | 1,722 |
| Líneas en CalendarView.jsx | 3,278 |
| Componentes reutilizables | 5 |
| Hooks personalizados | 0 |
| Servicios | 0 |
| Cobertura de tests | 0% |
| Props drilling (max depth) | 4 niveles |
| Tiempo de compilación | ~9s |

### Después de Refactorización (Objetivo)

| Métrica | Valor | Mejora |
|---------|-------|--------|
| Líneas en App.jsx | <200 | 🔽 88% |
| Líneas en CalendarView.jsx | <350 | 🔽 89% |
| Componentes reutilizables | 25+ | 🔼 400% |
| Hooks personalizados | 10+ | 🔼 NEW |
| Servicios | 6 | 🔼 NEW |
| Cobertura de tests | 60%+ | 🔼 NEW |
| Props drilling (max depth) | 1 nivel | 🔼 75% |
| Tiempo de compilación | ~9s | ➡️ Similar |

---

## ⚠️ Riesgos y Mitigación

### Riesgos Identificados

1. **Romper funcionalidad existente**
   - **Probabilidad:** Media
   - **Impacto:** Alto
   - **Mitigación:** Testing manual exhaustivo después de cada fase

2. **Perder contexto entre sesiones de Claude**
   - **Probabilidad:** Alta
   - **Impacto:** Medio
   - **Mitigación:** Commits frecuentes, documentación detallada

3. **Introducir bugs sutiles**
   - **Probabilidad:** Media
   - **Impacto:** Medio
   - **Mitigación:** Staging environment, testing con usuarios

4. **Degradación de performance**
   - **Probabilidad:** Baja
   - **Impacto:** Alto
   - **Mitigación:** Profiler de React, memoización adecuada

5. **Merge conflicts**
   - **Probabilidad:** Baja (single developer)
   - **Impacto:** Bajo
   - **Mitigación:** Branch dedicada, no trabajar en main

### Plan de Rollback

```bash
# Si algo sale mal en cualquier momento:
git checkout main
git branch -D refactor/modular-architecture

# O restaurar desde backup:
git checkout backup/pre-refactoring-20260325
```

---

## 📝 Checklist de Pre-Requisitos

Antes de empezar Semana 1, confirmar:

- [ ] ✅ Backup creado: `backup/pre-refactoring-20260325`
- [ ] ✅ Branch creada: `refactor/modular-architecture`
- [ ] ✅ Credenciales de R2 rotadas
- [ ] ✅ .env.local creado con nuevas credenciales
- [ ] ✅ .env.production actualizado
- [ ] ✅ .gitignore incluye `.env*`
- [ ] ⏳ Staging environment configurado (opcional pero recomendado)
- [ ] ⏳ Tests setup (opcional)
- [ ] ✅ Este documento leído completamente
- [ ] ✅ Usuario informado del plan y timeline

---

## 🚀 Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build:production

# Preview de build
npm run preview

# Linting
npm run lint

# Testing (si configurado)
npm run test
npm run test:watch
npm run test:coverage

# Git workflow
git status
git add .
git commit -m "refactor(calendar): extract TournamentCard component"
git push origin refactor/modular-architecture

# Ver diff de archivos grandes
git diff --stat
```

---

## 📚 Referencias

- **Documentos relacionados:**
  - `ESTADO_ACTUAL.md` - Estado del proyecto
  - `ESQUEMA_FUNCIONALIDADES.md` - Features planificadas
  - `SETUP_STAGING_ENVIRONMENT.md` - Configurar staging
  - `SENTRY_CONFIGURED.md` - Error monitoring

- **Recursos externos:**
  - [React Context API](https://react.dev/reference/react/createContext)
  - [Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
  - [Composition vs Inheritance](https://react.dev/learn/thinking-in-react)
  - [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

## ✅ Aprobación

**Revisado por:** Usuario
**Aprobado para ejecución:** [ ]
**Fecha de inicio:** ___________
**Fecha estimada de finalización:** ___________

---

**Notas finales:**

Este plan es ambicioso pero realista. La clave del éxito es:

1. **Ir paso a paso** - No saltar fases
2. **Testing frecuente** - Validar después de cada cambio
3. **Commits pequeños** - Facilitar rollback si es necesario
4. **Documentar decisiones** - Para futuro mantenimiento

La refactorización es una inversión. El código resultante será **4-5x más mantenible**, **infinitamente más testeable**, y **mucho más escalable** para las 132 features pendientes en el roadmap.

¡Éxito! 🚀

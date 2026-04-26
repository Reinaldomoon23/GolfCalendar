# 🏆 LEADERBOARD ROADMAP — Sistema de Clasificación General Centralizada
# Players Calendar / RoundTracker
# Última actualización: 2026-04-26

---

## ESTADO GLOBAL
- FASE 1: 🔶 EN PROGRESO (3/5 pasos completados)
- FASE 2: ⏳ PENDIENTE
- FASE 3: ⏳ PENDIENTE

---

## CONTEXTO DEL PROYECTO

### ¿Qué es?
PWA de golf donde jugadoras registran resultados en torneos. El problema es que cada una crea el torneo por separado → datos aislados → no hay clasificación conjunta.

### ¿Qué queremos?
Que al guardar resultados de un torneo compartido, la jugadora aparezca automáticamente en una clasificación general que todos puedan ver.

### Estructura de Firestore (colecciones relevantes)
```
/users/{userDocId}/results/{tournamentId}        → resultados privados de cada jugadora
/users/{userDocId}/custom_tournaments/{id}       → torneos en el calendario personal
/tournaments/{id}                                → torneos oficiales
/shared_tournaments/{id}                         → torneos publicados a la comunidad
/tournaments/{id}/participants/{username}        → ← NUEVA: resúmenes públicos de clasificación
```

### IDs de torneos
- Numéricos (ej: `45`) → torneos oficiales del JSON/Firestore
- Slug con guión bajo (ej: `trofeo-verano_15062026`) → torneos compartidos/centralizados
- La función `generateTournamentDeterministicId(name, dates)` genera el slug
- La función `isSharedTournamentId(id)` detecta si es centralizado (contiene `_`)

### Archivos clave del proyecto
| Archivo | Rol |
|---|---|
| `src/services/leaderboard.service.js` | 🆕 Servicio del leaderboard (creado en esta sesión) |
| `src/services/tournaments.service.js` | Gestión de torneos: CRUD, merge, shared |
| `src/services/results.service.js` | Guardado/lectura de resultados por usuario |
| `src/contexts/UserDataContext.jsx` | Contexto central: conecta resultados, torneos y preferencias |
| `src/components/CalendarView.jsx` | Vista principal: lista de torneos + detalle + scorecard |
| `src/components/TournamentLeaderboard.jsx` | 🆕 Componente de clasificación (creado en esta sesión) |
| `src/components/CommunityExplorerModal.jsx` | Modal para explorar y unirse a torneos compartidos |
| `src/components/PublicScorecardView.jsx` | Vista pública `/live/:username/:id` (ya tiene leaderboard parcial hardcoded) |
| `firestore.rules` | Reglas de seguridad de Firebase |

---

## FASE 1 — Clasificación General Mínima Viable
**Objetivo:** Que al guardar un resultado, aparezca automáticamente en la clasificación del torneo.

---

### ✅ PASO 1.1 — Crear `leaderboard.service.js`
**Archivo:** `src/services/leaderboard.service.js`
**Estado:** COMPLETADO

**Qué hace:**
- `isSharedTournamentId(id)` → devuelve `true` si el ID contiene `_` (es un torneo centralizado)
- `joinTournamentAsParticipant(user, tournamentId, meta)` → crea doc en `/tournaments/{id}/participants/{username}` sin score todavía
- `updateParticipantScore(user, tournamentId, resultData)` → escribe resumen público (total, rondas, vs par) en `/tournaments/{id}/participants/{username}`
- `subscribeToLeaderboard(tournamentId, callback)` → escucha en tiempo real y devuelve array ordenado por golpes (menos = mejor)

---

### ✅ PASO 1.2 — Auto-sync de resultados al leaderboard
**Archivo:** `src/contexts/UserDataContext.jsx`
**Estado:** COMPLETADO

**Qué hace:**
Modifica `handleSaveSpecificResult()` para que, además de guardar en `/users/.../results/`, llame silenciosamente a `updateParticipantScore()` si el torneo tiene un ID centralizado.
No bloquea la UI. Usa `.catch()` para ignorar errores sin romper nada.

**Imports añadidos:**
```js
import { updateParticipantScore, isSharedTournamentId } from '../services/leaderboard.service';
```

---

### ✅ PASO 1.3 — Crear `TournamentLeaderboard.jsx`
**Archivo:** `src/components/TournamentLeaderboard.jsx`
**Estado:** COMPLETADO

**Props:**
```js
<TournamentLeaderboard
  tournamentId="trofeo-verano_15062026"  // ID del torneo centralizado
  par={72}                                // Par del campo
  currentUsername="nicole"               // Para resaltar la fila del usuario actual
/>
```

**Qué muestra:**
- Tabla con: Posición (medalla para top 3) | Foto + Nombre | Rondas jugadas | Total golpes | vs Par
- Jugadoras sin score aparecen debajo con "Pendientes de jugar"
- Usuario actual resaltado en azul con etiqueta "TÚ"
- Estado vacío elegante si no hay nadie
- Actualización en tiempo real vía `onSnapshot`

---

### ⏳ PASO 1.4 — Integrar leaderboard en CalendarView (pestaña "Clasificación")
**Archivo:** `src/components/CalendarView.jsx`
**Estado:** PENDIENTE

**Qué hay que hacer:**

1. Añadir import en la parte superior:
```js
import TournamentLeaderboard from './TournamentLeaderboard';
import { isSharedTournamentId } from '../services/leaderboard.service';
```

2. Añadir estado para controlar qué pestaña está activa en el detalle:
```js
const [detailTab, setDetailTab] = useState('results'); // 'results' | 'leaderboard'
```

3. Buscar el bloque donde se renderiza el detalle del torneo seleccionado (arriba del scorecard, donde pone "Introducir Resultados"). Añadir antes de ese bloque las pestañas:
```jsx
{/* Solo mostrar pestañas si el torneo es centralizado */}
{isSharedTournamentId(selectedTournament.id) && (
  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '0' }}>
    <button
      onClick={() => setDetailTab('results')}
      style={{
        padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
        fontWeight: '700', fontSize: '0.9rem',
        color: detailTab === 'results' ? 'var(--color-primary)' : '#94a3b8',
        borderBottom: detailTab === 'results' ? '2px solid var(--color-primary)' : '2px solid transparent',
        marginBottom: '-2px', transition: 'all 0.2s'
      }}
    >
      📝 Mis Resultados
    </button>
    <button
      onClick={() => setDetailTab('leaderboard')}
      style={{
        padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
        fontWeight: '700', fontSize: '0.9rem',
        color: detailTab === 'leaderboard' ? 'var(--color-primary)' : '#94a3b8',
        borderBottom: detailTab === 'leaderboard' ? '2px solid var(--color-primary)' : '2px solid transparent',
        marginBottom: '-2px', transition: 'all 0.2s'
      }}
    >
      🏆 Clasificación
    </button>
  </div>
)}
```

4. Envolver el contenido de resultados en `{detailTab === 'results' && (...)}` y añadir:
```jsx
{detailTab === 'leaderboard' && (
  <TournamentLeaderboard
    tournamentId={String(selectedTournament.id)}
    par={getTournamentPar(selectedTournament, results[selectedTournament.id], spanishCourses)}
    currentUsername={user?.username}
  />
)}
```

5. Reset de pestaña al cambiar de torneo (añadir en el `useEffect` que depende de `selectedTournament`):
```js
setDetailTab('results');
```

**Dónde buscar en CalendarView.jsx:**
- El `useEffect` que inicializa el formulario al seleccionar torneo está alrededor de la línea 348
- El bloque donde empieza el detalle del torneo (el JSX con `Introducir Resultados`) está alrededor de la línea 2062-2065
- Buscar el texto exacto `h2` con `Introducir Resultados` para ubicar el punto de inserción

---

### ⏳ PASO 1.5 — Actualizar reglas de Firestore
**Archivo:** `firestore.rules`
**Estado:** PENDIENTE

**Qué hay que hacer:**
Añadir estas reglas al archivo para permitir que cualquiera lea los participantes (la clasificación es pública) pero solo el propio usuario pueda escribir su doc:

```
// Leaderboard: public read, self-write only
match /tournaments/{tournamentId}/participants/{username} {
  allow read: if true;
  allow write: if request.auth != null
    && (
      request.auth.token.username == username
      || request.auth.uid == username
      || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.username == username
    );
}
```

**Nota:** Después de editar el archivo, hay que desplegar las reglas con:
```bash
firebase deploy --only firestore:rules
```
O desde la consola web de Firebase → Firestore → Rules.

---

## FASE 2 — Mejoras de UX

### ⏳ PASO 2.1 — Conteo de participantes en CommunityExplorerModal
**Archivo:** `src/components/CommunityExplorerModal.jsx`

Mostrar "👥 4 apuntadas" en cada tarjeta de torneo del catálogo.
- Leer tamaño de `/tournaments/{id}/participants` al montar el modal
- Usar `getDocs()` una sola vez (no tiempo real) para no saturar lecturas

### ⏳ PASO 2.2 — Join automático al apuntarse
**Archivos:** `src/components/CalendarView.jsx`, `src/contexts/UserDataContext.jsx`

Cuando la usuaria pulsa "Apuntarse" en el modal de comunidad:
- Además de añadir a `custom_tournaments`, llamar a `joinTournamentAsParticipant()`
- Así aparece en la clasificación aunque aún no haya jugado

### ⏳ PASO 2.3 — Badge de participantes en lista de torneos
**Archivo:** `src/components/CalendarView.jsx` (lista principal)

En las tarjetas de torneos compartidos, mostrar un badge con el número de participantes.

---

## FASE 3 — Funcionalidades avanzadas

### ⏳ PASO 3.1 — Página pública de leaderboard
**Ruta nueva:** `/leaderboard/:tournamentId`
**Archivos:** `src/App.jsx` (añadir ruta), nuevo componente `src/components/PublicLeaderboardPage.jsx`

Página sin login que cualquiera puede ver con link directo. Misma lógica que `TournamentLeaderboard` pero a pantalla completa.

### ⏳ PASO 3.2 — Panel de admin para torneos centralizados
**Archivo:** `src/components/admin/TournamentsAdminPanel.jsx`

- Crear torneos directamente como "centralizados" (bandera `isCentral: true`)
- Ver lista de participantes desde el panel de admin

### ⏳ PASO 3.3 — Clasificaciones por ronda
**Archivo:** `src/components/TournamentLeaderboard.jsx`

- Filtro por ronda: D1, D2, Total
- Mostrar score de cada ronda individual

---

## NOTAS TÉCNICAS PARA EL SIGUIENTE MODELO

1. El proyecto usa **React 19 + Vite 7 + Firebase 12 + React Router 7**
2. No usa TailwindCSS. Los estilos son inline con objetos JS o clases CSS en `index.css`
3. `db` se importa de `'../firebase'` (ruta relativa desde `src/`)
4. Para obtener el docId de un usuario siempre usar `getUserDocId(user)` de `'../utils/userProfiles'`
5. Los `useEffect` con suscripciones Firestore SIEMPRE deben devolver la función de unsubscribe
6. El componente `ProfileImage` acepta `username` y `size` como props
7. La variable CSS `--color-primary` es el azul principal de la app
8. Para deploy: `npm run deploy:all` (build + Vercel + FTP Hostinger)
9. Para GitHub: `git add . && git commit -m "..." && git push -u origin main`

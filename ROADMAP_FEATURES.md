# Roadmap de Nuevas Funcionalidades - Golf Tracker

**Fecha**: 17 de marzo de 2026
**Versión actual**: 2.4.8

---

## 🎯 Funcionalidades Planificadas

### 1. Sistema de Amigos y Social Features ⏰ FUTURO
### 2. Compartir Torneos Configurados ⏰ FUTURO
### 3. Comparación de Estadísticas entre Amigos ⏰ FUTURO
### 4. Mejoras en Modo Live ✅ IMPLEMENTAR YA

---

## 📋 1. Sistema de Amigos

### Objetivo
Permitir a los usuarios agregar amigos, ver sus perfiles y compartir actividad golfística.

### Schema de Datos Firestore

#### Nueva colección: `friend_requests`
```javascript
friend_requests/{requestId} {
  from_uid: "uid_david",
  to_uid: "uid_nicole",
  status: "pending" | "accepted" | "rejected",
  created_at: Timestamp,
  updated_at: Timestamp
}
```

#### Nueva subcolección: `users/{uid}/friends/{friendUid}`
```javascript
users/{uid}/friends/{friendUid} {
  friend_uid: "uid_nicole",
  friend_username: "nicole",
  friend_name: "Nicole Likhomanova",
  friend_photo: "https://...",
  added_at: Timestamp,
  shared_tournaments: [], // IDs de torneos compartidos
  allow_stats_comparison: true, // Permiso para comparar estadísticas
  notes: "" // Notas privadas sobre el amigo
}
```

#### Actualización en `users/{uid}`
```javascript
users/{uid} {
  // ... campos existentes
  friends_count: 5,
  privacy: {
    allow_friend_requests: true,
    show_results_to_friends: true,
    show_stats_to_friends: true,
    show_handicap_to_friends: true
  }
}
```

### Componentes UI

#### 1. `FriendsView.jsx` (Nueva Vista)
**Ubicación**: `src/components/FriendsView.jsx`

**Secciones**:
- **Lista de amigos** (tarjetas con foto, nombre, último hándicap)
- **Solicitudes pendientes** (badge con contador)
- **Buscar usuarios** (por username o email)
- **Invitaciones enviadas**

**Funcionalidades**:
- Ver perfil público del amigo
- Eliminar amigo (confirmación)
- Enviar mensaje/nota
- Acceso rápido a comparación de stats

#### 2. `FriendRequestsModal.jsx`
**Ubicación**: `src/components/FriendRequestsModal.jsx`

**Funcionalidades**:
- Listar solicitudes pendientes
- Aceptar/Rechazar con un tap
- Notificaciones en tiempo real (Firestore onSnapshot)

#### 3. `AddFriendModal.jsx`
**Ubicación**: `src/components/AddFriendModal.jsx`

**Funcionalidades**:
- Buscar por username (autocomplete)
- Buscar por email
- Escanear QR del amigo
- Generar QR propio para compartir

### API Functions

**Archivo**: `src/utils/friendsApi.js`

```javascript
// Enviar solicitud de amistad
export async function sendFriendRequest(db, fromUid, toUsername) {
  // 1. Resolver toUsername -> toUid
  const toProfile = await fetchUserProfileByUsername(db, toUsername);

  // 2. Verificar que no sean ya amigos
  const existingFriend = await getDoc(doc(db, 'users', fromUid, 'friends', toProfile.uid));
  if (existingFriend.exists()) {
    throw new Error('Ya son amigos');
  }

  // 3. Verificar solicitud pendiente
  const existingRequest = await getDocs(query(
    collection(db, 'friend_requests'),
    where('from_uid', '==', fromUid),
    where('to_uid', '==', toProfile.uid),
    where('status', '==', 'pending')
  ));
  if (!existingRequest.empty) {
    throw new Error('Ya existe una solicitud pendiente');
  }

  // 4. Crear solicitud
  await addDoc(collection(db, 'friend_requests'), {
    from_uid: fromUid,
    to_uid: toProfile.uid,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // 5. TODO: Enviar notificación push (futuro)
}

// Aceptar solicitud
export async function acceptFriendRequest(db, requestId, currentUid) {
  const requestRef = doc(db, 'friend_requests', requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) throw new Error('Solicitud no encontrada');

  const request = requestSnap.data();
  if (request.to_uid !== currentUid) throw new Error('No autorizado');

  // 1. Actualizar estado de solicitud
  await updateDoc(requestRef, {
    status: 'accepted',
    updated_at: new Date().toISOString()
  });

  // 2. Obtener perfiles
  const fromProfile = await getDoc(doc(db, 'users', request.from_uid));
  const toProfile = await getDoc(doc(db, 'users', request.to_uid));

  // 3. Agregar amigo mutuamente
  const batch = writeBatch(db);

  // A -> B
  batch.set(doc(db, 'users', request.from_uid, 'friends', request.to_uid), {
    friend_uid: request.to_uid,
    friend_username: toProfile.data().username,
    friend_name: toProfile.data().full_name,
    friend_photo: toProfile.data().photo_url,
    added_at: new Date().toISOString(),
    allow_stats_comparison: true
  });

  // B -> A
  batch.set(doc(db, 'users', request.to_uid, 'friends', request.from_uid), {
    friend_uid: request.from_uid,
    friend_username: fromProfile.data().username,
    friend_name: fromProfile.data().full_name,
    friend_photo: fromProfile.data().photo_url,
    added_at: new Date().toISOString(),
    allow_stats_comparison: true
  });

  // Incrementar contadores
  batch.update(doc(db, 'users', request.from_uid), {
    friends_count: increment(1)
  });
  batch.update(doc(db, 'users', request.to_uid), {
    friends_count: increment(1)
  });

  await batch.commit();
}

// Rechazar solicitud
export async function rejectFriendRequest(db, requestId, currentUid) {
  const requestRef = doc(db, 'friend_requests', requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) throw new Error('Solicitud no encontrada');

  const request = requestSnap.data();
  if (request.to_uid !== currentUid) throw new Error('No autorizado');

  await updateDoc(requestRef, {
    status: 'rejected',
    updated_at: new Date().toISOString()
  });
}

// Eliminar amigo
export async function removeFriend(db, currentUid, friendUid) {
  const batch = writeBatch(db);

  // Eliminar de ambos lados
  batch.delete(doc(db, 'users', currentUid, 'friends', friendUid));
  batch.delete(doc(db, 'users', friendUid, 'friends', currentUid));

  // Decrementar contadores
  batch.update(doc(db, 'users', currentUid), {
    friends_count: increment(-1)
  });
  batch.update(doc(db, 'users', friendUid), {
    friends_count: increment(-1)
  });

  await batch.commit();
}

// Obtener amigos
export async function getFriends(db, uid) {
  const snapshot = await getDocs(collection(db, 'users', uid, 'friends'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Obtener solicitudes pendientes
export async function getPendingRequests(db, uid) {
  const snapshot = await getDocs(query(
    collection(db, 'friend_requests'),
    where('to_uid', '==', uid),
    where('status', '==', 'pending'),
    orderBy('created_at', 'desc')
  ));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

### Integración en App.jsx

```javascript
// Agregar tab de Amigos en navegación
<Route path="/friends" element={<FriendsView user={user} />} />

// Badge de notificaciones en tab
const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

useEffect(() => {
  if (!user?.uid) return;

  const unsubscribe = onSnapshot(
    query(
      collection(db, 'friend_requests'),
      where('to_uid', '==', user.uid),
      where('status', '==', 'pending')
    ),
    (snapshot) => {
      setPendingRequestsCount(snapshot.size);
    }
  );

  return () => unsubscribe();
}, [user?.uid]);
```

### Reglas de Seguridad Firestore

```javascript
// friend_requests
match /friend_requests/{requestId} {
  allow read: if request.auth != null &&
    (resource.data.from_uid == request.auth.uid || resource.data.to_uid == request.auth.uid);

  allow create: if request.auth != null &&
    request.resource.data.from_uid == request.auth.uid &&
    request.resource.data.status == 'pending';

  allow update: if request.auth != null &&
    (resource.data.to_uid == request.auth.uid &&
     request.resource.data.status in ['accepted', 'rejected']);
}

// friends subcollection
match /users/{uid}/friends/{friendId} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false; // Solo via Cloud Functions o batch operations verificadas
}
```

---

## 📋 2. Compartir Torneos Configurados

### Objetivo
Permitir a los usuarios compartir sus torneos personalizados con amigos.

### Schema de Datos

#### Actualización en `custom_tournaments`
```javascript
users/{uid}/custom_tournaments/{tournamentId} {
  // ... campos existentes
  shared_with: ["uid_friend1", "uid_friend2"], // UIDs con los que se compartió
  is_public: false, // Si es visible para cualquiera
  created_by_uid: "uid_creator",
  created_by_name: "Nicole",
  allow_edits_by_friends: false, // Si los amigos pueden editar
  share_link: "https://golf.app/t/abc123" // Link público (opcional)
}
```

#### Nueva colección: `shared_tournaments` (caché para lectura rápida)
```javascript
shared_tournaments/{sharedId} {
  tournament_id: "custom_123",
  owner_uid: "uid_nicole",
  shared_with_uid: "uid_david",
  tournament_data: { /* snapshot del torneo */ },
  shared_at: Timestamp,
  allow_copy: true, // Si puede copiar a sus propios torneos
  allow_results: true // Si puede registrar resultados
}
```

### Componentes UI

#### 1. Botón de Compartir en Torneo
**Ubicación**: En `CalendarView.jsx` dentro del modal de torneo

```javascript
<button onClick={() => setShowShareModal(true)} style={{ ... }}>
  <Users size={18} /> Compartir Torneo
</button>
```

#### 2. `ShareTournamentModal.jsx`
**Ubicación**: `src/components/ShareTournamentModal.jsx`

**Funcionalidades**:
- Lista de amigos con checkboxes
- Toggle "Permitir copiar"
- Toggle "Permitir registrar resultados"
- Generar link público
- Copiar link al portapapeles
- Vista previa del torneo compartido

### API Functions

**Archivo**: `src/utils/shareTournaments.js`

```javascript
// Compartir torneo con amigos
export async function shareTournamentWithFriends(db, tournamentData, ownerUid, friendUids, permissions) {
  const batch = writeBatch(db);

  // 1. Actualizar torneo original
  const tournamentRef = getUserSubdocRef(db, { uid: ownerUid }, 'custom_tournaments', tournamentData.id);
  batch.update(tournamentRef, {
    shared_with: arrayUnion(...friendUids),
    updated_at: new Date().toISOString()
  });

  // 2. Crear entradas en shared_tournaments para cada amigo
  for (const friendUid of friendUids) {
    const sharedRef = doc(collection(db, 'shared_tournaments'));
    batch.set(sharedRef, {
      tournament_id: tournamentData.id,
      owner_uid: ownerUid,
      shared_with_uid: friendUid,
      tournament_data: tournamentData,
      shared_at: new Date().toISOString(),
      allow_copy: permissions.allowCopy || false,
      allow_results: permissions.allowResults || false
    });
  }

  await batch.commit();

  // 3. TODO: Notificar a amigos
}

// Copiar torneo compartido a mis torneos
export async function copySharedTournament(db, sharedTournamentId, targetUid) {
  const sharedSnap = await getDoc(doc(db, 'shared_tournaments', sharedTournamentId));

  if (!sharedSnap.exists()) throw new Error('Torneo compartido no encontrado');

  const shared = sharedSnap.data();
  if (shared.shared_with_uid !== targetUid) throw new Error('No autorizado');
  if (!shared.allow_copy) throw new Error('No tienes permiso para copiar este torneo');

  // Crear copia en custom_tournaments del usuario
  const newId = `shared_copy_${Date.now()}`;
  await setDoc(
    getUserSubdocRef(db, { uid: targetUid }, 'custom_tournaments', newId),
    {
      ...shared.tournament_data,
      id: newId,
      custom: true,
      copied_from: shared.owner_uid,
      copied_at: new Date().toISOString(),
      shared_with: [] // Reset compartidos
    }
  );

  return newId;
}

// Obtener torneos compartidos conmigo
export async function getSharedTournaments(db, uid) {
  const snapshot = await getDocs(query(
    collection(db, 'shared_tournaments'),
    where('shared_with_uid', '==', uid),
    orderBy('shared_at', 'desc')
  ));

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

### Integración en CalendarView

```javascript
const [sharedTournaments, setSharedTournaments] = useState([]);

useEffect(() => {
  if (!user?.uid) return;

  const unsubscribe = onSnapshot(
    query(
      collection(db, 'shared_tournaments'),
      where('shared_with_uid', '==', user.uid)
    ),
    (snapshot) => {
      const shared = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSharedTournaments(shared);
    }
  );

  return () => unsubscribe();
}, [user?.uid]);

// Merge shared tournaments con torneos personales
const allTournaments = useMemo(() => {
  const shared = sharedTournaments.map(s => ({
    ...s.tournament_data,
    isShared: true,
    sharedBy: s.owner_uid,
    sharedId: s.id
  }));

  return [...baseTournaments, ...customTournaments, ...shared];
}, [baseTournaments, customTournaments, sharedTournaments]);
```

---

## 📋 3. Comparación de Estadísticas entre Amigos

### Objetivo
Permitir comparar estadísticas de golf con amigos de forma visual y útil.

### Componentes UI

#### 1. `FriendComparisonView.jsx`
**Ubicación**: `src/components/FriendComparisonView.jsx`

**Secciones**:
- **Selector de amigos** (hasta 3 para comparar)
- **Selector de periodo** (último mes, último año, todo el tiempo)
- **Selector de métricas**:
  - Hándicap promedio
  - Score promedio (bruto/neto)
  - Birdies/Eagles/Bogeys totales
  - % GIR (Greens in Regulation)
  - Promedio de putts
  - Mejores/peores campos
  - Head-to-head (torneos en común)

**Gráficos**:
- Gráfico de barras comparativo
- Gráfico de líneas (evolución temporal)
- Radar chart (múltiples métricas)

#### 2. Ejemplo de Implementación

```javascript
import { Radar, Bar, Line } from 'react-chartjs-2';

function FriendComparisonView({ user, friends }) {
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [metric, setMetric] = useState('avg_score');
  const [period, setPeriod] = useState('last_year');

  const [comparisonData, setComparisonData] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      if (selectedFriends.length === 0) return;

      const allStats = await Promise.all([
        getPlayerStats(db, user.uid, period),
        ...selectedFriends.map(f => getPlayerStats(db, f.friend_uid, period))
      ]);

      setComparisonData({
        labels: [user.full_name, ...selectedFriends.map(f => f.friend_name)],
        datasets: [{
          label: 'Score Promedio',
          data: allStats.map(s => s.avg_score),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
        }]
      });
    }

    fetchStats();
  }, [selectedFriends, metric, period]);

  return (
    <div>
      <h2>Comparar con Amigos</h2>

      {/* Selector de amigos */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
        {friends.map(friend => (
          <div
            key={friend.id}
            onClick={() => toggleFriend(friend)}
            style={{
              padding: '10px',
              border: selectedFriends.includes(friend) ? '2px solid blue' : '1px solid gray',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <img src={friend.friend_photo} style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
            <p>{friend.friend_name}</p>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      {comparisonData && (
        <Bar data={comparisonData} options={{ ... }} />
      )}

      {/* Head-to-Head (torneos en común) */}
      <div>
        <h3>Torneos en Común</h3>
        {/* Listar torneos donde ambos jugaron */}
      </div>
    </div>
  );
}
```

### API Functions

**Archivo**: `src/utils/statsComparison.js`

```javascript
// Obtener estadísticas de un jugador
export async function getPlayerStats(db, uid, period = 'all') {
  const resultsRef = collection(db, 'users', uid, 'results');

  // Filtrar por periodo
  let q = resultsRef;
  if (period === 'last_month') {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    q = query(resultsRef, where('created_at', '>=', oneMonthAgo.toISOString()));
  } else if (period === 'last_year') {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    q = query(resultsRef, where('created_at', '>=', oneYearAgo.toISOString()));
  }

  const snapshot = await getDocs(q);

  // Calcular estadísticas
  let totalScore = 0;
  let totalNet = 0;
  let totalBirdies = 0;
  let totalEagles = 0;
  let totalPar = 0;
  let count = 0;

  snapshot.forEach(doc => {
    const result = doc.data();

    if (result.score) {
      totalScore += result.score;
      totalNet += result.net || result.score;
      count++;
    }

    // Contar birdies/eagles/par hoyo por hoyo
    if (result.scorecards) {
      Object.values(result.scorecards).forEach(card => {
        for (let i = 0; i < 18; i++) {
          const stroke = parseInt(card.strokes?.[i]);
          const par = parseInt(card.pars?.[i]);

          if (stroke && par) {
            const diff = stroke - par;
            if (diff === -1) totalBirdies++;
            else if (diff === -2) totalEagles++;
            else if (diff === 0) totalPar++;
          }
        }
      });
    }
  });

  return {
    avg_score: count > 0 ? (totalScore / count).toFixed(1) : 0,
    avg_net: count > 0 ? (totalNet / count).toFixed(1) : 0,
    total_rounds: count,
    birdies: totalBirdies,
    eagles: totalEagles,
    pars: totalPar
  };
}

// Obtener torneos en común entre dos jugadores
export async function getCommonTournaments(db, uid1, uid2) {
  const results1 = await getDocs(collection(db, 'users', uid1, 'results'));
  const results2 = await getDocs(collection(db, 'users', uid2, 'results'));

  const tournamentIds1 = new Set(results1.docs.map(doc => doc.id));
  const tournamentIds2 = new Set(results2.docs.map(doc => doc.id));

  const common = [...tournamentIds1].filter(id => tournamentIds2.has(id));

  return Promise.all(common.map(async (tournamentId) => {
    const result1 = results1.docs.find(d => d.id === tournamentId)?.data();
    const result2 = results2.docs.find(d => d.id === tournamentId)?.data();

    return {
      tournamentId,
      tournament_name: result1.tournamentName || 'Torneo',
      player1_score: result1.score,
      player1_net: result1.net,
      player2_score: result2.score,
      player2_net: result2.net,
      winner: (result1.net || result1.score) < (result2.net || result2.score) ? uid1 : uid2
    };
  }));
}
```

### Integración en App.jsx

```javascript
<Route path="/compare" element={
  <FriendComparisonView
    user={user}
    friends={userFriends}
    results={results}
    tournaments={tournaments}
  />
} />
```

---

## ✅ 4. Mejoras en Modo Live (IMPLEMENTAR YA)

### Problema Actual
1. **URL compartida no incluye el nombre del jugador** - Solo dice "Sigue los resultados de {username}"
2. **No suma las dos vueltas** - En torneos de 36 hoyos (2 vueltas), no muestra el total acumulado

### Solución

#### A. Incluir nombre del jugador en mensaje compartido

**Archivo a modificar**: `src/components/CalendarView.jsx`

**Buscar la función de compartir** (aproximadamente línea con `navigator.share`):

```javascript
// ANTES
await navigator.share({
  title: `Resultados de ${t.name}`,
  text: `Sigue mi vuelta en vivo: ${t.name}`,
  url: shareUrl
});

// DESPUÉS
await navigator.share({
  title: `${user.full_name} - ${t.name}`,
  text: `Sigue la vuelta de ${user.full_name} en ${t.name}\n\n📍 ${t.location}\n⛳ En directo`,
  url: shareUrl
});
```

#### B. Sumar golpes de primera y segunda vuelta

**Archivo a modificar**: `src/components/PublicScorecardView.jsx`

**Cambios necesarios**:

1. **Calcular total acumulado** (líneas 509-570 aproximadamente):

```javascript
// AÑADIR después de la línea 463 (inicio de resultados)
{(() => {
  const roundsKeys = Object.keys(result.scorecards || {});
  if (roundsKeys.length === 0) return null;

  // NUEVO: Calcular total acumulado de todas las vueltas
  let cumulativeScore = 0;
  let cumulativePar = 0;
  let totalHolesPlayed = 0;

  roundsKeys.forEach(rIdx => {
    const card = result.scorecards[rIdx];
    for (let i = 0; i < 18; i++) {
      const strokeStr = String(card.strokes?.[i] || '');
      if (strokeStr !== '' && strokeStr !== '-') {
        const s = parseInt(strokeStr);
        if (!isNaN(s) && s > 0) {
          cumulativeScore += s;
          const p = parseInt(card.pars?.[i]);
          cumulativePar += (!isNaN(p) && p > 0 ? p : 4);
          totalHolesPlayed++;
        }
      }
    }
  });

  const cumulativeDiff = cumulativeScore - cumulativePar;
  const cumulativeDiffStr = cumulativeDiff > 0 ? `+${cumulativeDiff}` : cumulativeDiff < 0 ? `${cumulativeDiff}` : 'E';
  const cumulativeDiffColor = cumulativeDiff > 0 ? '#ef4444' : cumulativeDiff < 0 ? '#10b981' : '#94a3b8';

  // Mostrar total acumulado solo si hay más de 1 vuelta
  return (
    <>
      {roundsKeys.length > 1 && totalHolesPlayed > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          border: '2px solid #3b82f6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem', fontWeight: '800' }}>
              📊 TOTAL ACUMULADO ({totalHolesPlayed} hoyos)
            </h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white' }}>
                {cumulativeScore}
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: cumulativeDiffColor }}>
                ({cumulativeDiffStr})
              </span>
            </div>
          </div>
          <div style={{
            marginTop: '10px',
            fontSize: '0.9rem',
            color: '#94a3b8',
            display: 'flex',
            gap: '20px'
          }}>
            <span>🎯 Par acumulado: {cumulativePar}</span>
            <span>⛳ Hoyos: {totalHolesPlayed}/36</span>
          </div>
        </div>
      )}

      {/* Aquí va el resto del código existente de displayRounds.map() */}
```

2. **Mejorar título de cada vuelta** para que sea más claro:

```javascript
// Modificar línea 562 aproximadamente
// ANTES
<h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>
  {t.round} {roundStr + 1}
</h3>

// DESPUÉS
<h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>
  {t.round} {roundStr + 1} {roundsKeys.length > 1 ? `(Vuelta ${roundStr + 1} de ${roundsKeys.length})` : ''}
</h3>
```

### Archivos a modificar

```
✏️ src/components/CalendarView.jsx
  - Función navigator.share (añadir nombre del jugador)

✏️ src/components/PublicScorecardView.jsx
  - Calcular total acumulado de vueltas
  - Mostrar tarjeta de resumen total
  - Mejorar títulos de cada vuelta
```

### Código completo a implementar

**1. CalendarView.jsx - Buscar todas las instancias de `navigator.share`**:

```javascript
// Buscar esta línea aproximada:
await navigator.share({

// Reemplazar por:
await navigator.share({
  title: `${user.full_name} - ${t.name}`,
  text: `⛳ Sigue la vuelta de ${user.full_name}\n\n🏆 ${t.name}\n📍 ${t.location || t.course}\n\n🔴 EN DIRECTO`,
  url: shareUrl
});
```

**2. PublicScorecardView.jsx - Añadir después de la línea 463**:

Ver código completo arriba en sección "B. Sumar golpes de primera y segunda vuelta"

### Testing

**Casos a probar**:
1. ✅ Compartir torneo de 1 vuelta (18 hoyos) - Debe mostrar mensaje con nombre
2. ✅ Compartir torneo de 2 vueltas (36 hoyos) - Debe mostrar total acumulado
3. ✅ URL compartida debe llevar al live view correctamente
4. ✅ Mensaje compartido debe incluir nombre completo del jugador
5. ✅ Total acumulado debe sumar ambas vueltas correctamente
6. ✅ Cada vuelta debe seguir mostrándose individualmente

---

## 🗓️ Plan de Implementación

### Fase 1: Mejoras Live (INMEDIATO) ⏰ 1-2 horas
- [x] Modificar mensaje compartido con nombre del jugador
- [x] Implementar suma de vueltas en PublicScorecardView
- [ ] Testing en producción con torneo real

### Fase 2: Sistema de Amigos (2 semanas)
- [ ] Schema Firestore
- [ ] API functions (friendsApi.js)
- [ ] Componente FriendsView
- [ ] Componente AddFriendModal
- [ ] Componente FriendRequestsModal
- [ ] Integración en App.jsx
- [ ] Reglas de seguridad
- [ ] Testing

### Fase 3: Compartir Torneos (1 semana)
- [ ] Schema shared_tournaments
- [ ] API functions (shareTournaments.js)
- [ ] Componente ShareTournamentModal
- [ ] Integración en CalendarView
- [ ] Notificaciones de torneos compartidos
- [ ] Testing

### Fase 4: Comparación de Estadísticas (2 semanas)
- [ ] API functions (statsComparison.js)
- [ ] Componente FriendComparisonView
- [ ] Gráficos comparativos (Chart.js)
- [ ] Head-to-head tournaments
- [ ] Exportar comparación a imagen
- [ ] Testing

---

## 📝 Notas Técnicas

### Consideraciones de Rendimiento
- **Amigos**: Denormalizar datos de amigos (nombre, foto) para evitar múltiples queries
- **Compartir Torneos**: Usar caché (shared_tournaments) en lugar de queries complejas
- **Estadísticas**: Precalcular stats mensualmente y guardar en subcolección `stats_cache`

### Privacidad
- Por defecto, resultados son privados
- Usuario debe activar "Compartir con amigos" explícitamente
- Hándicap solo visible si el usuario lo permite
- Torneos compartidos solo visibles para destinatarios

### Notificaciones (Futuro)
- Firebase Cloud Messaging (FCM)
- Notificar: solicitudes de amistad, torneos compartidos, comparaciones destacadas

---

## 📊 Impacto Esperado

### Engagement
- ⬆️ **+40%** tiempo en app (social features)
- ⬆️ **+60%** compartidos de resultados
- ⬆️ **+30%** retención mensual

### Métricas a Trackear
- Número de amigos promedio por usuario
- Torneos compartidos por mes
- Comparaciones de stats realizadas
- Compartidos de live view

---

**Última actualización**: 17 de marzo de 2026
**Autor**: Planificación conjunta con Claude

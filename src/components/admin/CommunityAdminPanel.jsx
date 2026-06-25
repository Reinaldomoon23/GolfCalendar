import { useEffect, useMemo, useState } from 'react';
import { Link2, RefreshCw, Search, Trash2, UserPlus, X } from 'lucide-react';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { dedupeAdminUsers } from '../../utils/adminUserRecords';

function pairId(uidA, uidB) {
  return [uidA, uidB].map(String).sort().join('__');
}

function profileSummary(profile) {
  return {
    uid: profile.id || profile.uid || profile.docId,
    username: profile.username || '',
    full_name: profile.full_name || profile.displayName || profile.username || '',
    photo_url: profile.photo_url || '',
  };
}

function formatUser(user) {
  if (!user) return 'Usuario desconocido';
  return `${user.full_name || user.username || user.uid} ${user.username ? `(@${user.username})` : ''}`.trim();
}

export default function CommunityAdminPanel() {
  const [users, setUsers] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userA, setUserA] = useState('');
  const [userB, setUserB] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const filteredFriendships = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return friendships;
    return friendships.filter((friendship) => {
      const names = (friendship.members || [])
        .map((uid) => formatUser(friendship.member_profiles?.[uid] || usersById.get(uid)))
        .join(' ')
        .toLowerCase();
      return names.includes(term);
    });
  }, [friendships, searchTerm, usersById]);

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) => (
      `${formatUser(request.from_user)} ${formatUser(request.to_user)} ${request.status || ''}`.toLowerCase().includes(term)
    ));
  }, [requests, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [usersSnap, friendshipsSnap, requestsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'friendships')),
        getDocs(collection(db, 'friend_requests')),
      ]);

      const rawUsers = usersSnap.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }));
      const dedupedUsers = dedupeAdminUsers(rawUsers)
        .filter((user) => user.id || user.uid)
        .sort((a, b) => String(a.full_name || a.username || '').localeCompare(String(b.full_name || b.username || ''), 'es'));

      setUsers(dedupedUsers);
      setFriendships(friendshipsSnap.docs.map((friendshipDoc) => ({ id: friendshipDoc.id, ...friendshipDoc.data() })));
      setRequests(requestsSnap.docs.map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() })));
    } catch (error) {
      console.error('[admin-community] Error loading data:', error);
      setMessage({ type: 'error', text: error.message || 'No se pudo cargar comunidad.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateFriendship = async () => {
    if (!userA || !userB || userA === userB) {
      setMessage({ type: 'error', text: 'Selecciona dos usuarios distintos.' });
      return;
    }

    const first = usersById.get(userA);
    const second = usersById.get(userB);
    if (!first || !second) {
      setMessage({ type: 'error', text: 'No se han encontrado los usuarios seleccionados.' });
      return;
    }

    const id = pairId(userA, userB);
    try {
      await setDoc(doc(db, 'friendships', id), {
        members: [userA, userB].sort(),
        member_profiles: {
          [userA]: profileSummary(first),
          [userB]: profileSummary(second),
        },
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by_admin: true,
      }, { merge: true });
      setMessage({ type: 'success', text: 'Amistad creada o reparada.' });
      await loadData();
    } catch (error) {
      console.error('[admin-community] Error creating friendship:', error);
      setMessage({ type: 'error', text: error.message || 'No se pudo crear la amistad.' });
    }
  };

  const handleDeleteFriendship = async (friendship) => {
    try {
      await deleteDoc(doc(db, 'friendships', friendship.id));
      setMessage({ type: 'success', text: 'Amistad eliminada.' });
      await loadData();
    } catch (error) {
      console.error('[admin-community] Error deleting friendship:', error);
      setMessage({ type: 'error', text: error.message || 'No se pudo eliminar la amistad.' });
    }
  };

  const handleDeleteRequest = async (request) => {
    try {
      await deleteDoc(doc(db, 'friend_requests', request.id));
      setMessage({ type: 'success', text: 'Solicitud eliminada.' });
      await loadData();
    } catch (error) {
      console.error('[admin-community] Error deleting request:', error);
      setMessage({ type: 'error', text: error.message || 'No se pudo eliminar la solicitud.' });
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>Comunidad</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b' }}>Mantenimiento de amistades, solicitudes y relaciones de chat.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadData} disabled={loading}>
          <RefreshCw size={16} />
          Refrescar
        </button>
      </div>

      {message && (
        <div style={{
          padding: '0.85rem 1rem',
          borderRadius: '8px',
          background: message.type === 'error' ? '#fef2f2' : '#ecfdf5',
          border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          color: message.type === 'error' ? '#991b1b' : '#166534',
          fontWeight: 800,
        }}>
          {message.text}
        </div>
      )}

      <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.85rem' }}>
        <h3 style={{ margin: 0, color: '#0f172a' }}>Crear amistad</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr) auto', gap: '0.75rem', alignItems: 'end' }}>
          <select value={userA} onChange={(event) => setUserA(event.target.value)} style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
            <option value="">Usuario 1</option>
            {users.map((candidate) => <option key={candidate.id} value={candidate.id}>{formatUser(candidate)}</option>)}
          </select>
          <select value={userB} onChange={(event) => setUserB(event.target.value)} style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
            <option value="">Usuario 2</option>
            {users.map((candidate) => <option key={candidate.id} value={candidate.id}>{formatUser(candidate)}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={handleCreateFriendship} disabled={loading || !userA || !userB || userA === userB}>
            <UserPlus size={16} />
            Crear
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
          <Search size={18} color="#64748b" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre, usuario o estado"
            style={{ flex: 1, padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
          />
        </div>

        <h3 style={{ margin: '0 0 0.75rem', color: '#0f172a' }}>Amistades ({filteredFriendships.length})</h3>
        <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {filteredFriendships.length === 0 ? (
            <div style={{ color: '#64748b', fontWeight: 700 }}>No hay amistades con ese filtro.</div>
          ) : filteredFriendships.map((friendship) => (
            <div key={friendship.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ color: '#334155', fontWeight: 800 }}>
                <Link2 size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                {(friendship.members || []).map((uid) => formatUser(friendship.member_profiles?.[uid] || usersById.get(uid))).join('  -  ')}
              </div>
              <button type="button" className="btn btn-danger" onClick={() => handleDeleteFriendship(friendship)}>
                <Trash2 size={16} />
                Eliminar
              </button>
            </div>
          ))}
        </div>

        <h3 style={{ margin: '0 0 0.75rem', color: '#0f172a' }}>Solicitudes ({filteredRequests.length})</h3>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {filteredRequests.length === 0 ? (
            <div style={{ color: '#64748b', fontWeight: 700 }}>No hay solicitudes con ese filtro.</div>
          ) : filteredRequests.map((request) => (
            <div key={request.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ color: '#334155', fontWeight: 800 }}>
                {formatUser(request.from_user)} -&gt; {formatUser(request.to_user)}
                <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>{request.status || 'pending'}</span>
              </div>
              <button type="button" className="btn btn-danger" onClick={() => handleDeleteRequest(request)}>
                <X size={16} />
                Cancelar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

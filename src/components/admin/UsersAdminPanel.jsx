import { useState, useEffect } from 'react';
import { Search, UserPlus, Edit, Trash2, Key, Shield, LogIn } from 'lucide-react';
import { initializeApp as initializeFirebaseApp, deleteApp } from 'firebase/app';
import { useNavigate } from 'react-router-dom';
import { db, auth, firebaseConfig } from '../../firebase';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { dedupeAdminUsers } from '../../utils/adminUserRecords';
import { API_ENDPOINTS } from '../../config/api';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  sendPasswordResetEmail,
  setPersistence
} from 'firebase/auth';
import { useFeedbackLayer } from '../FeedbackLayer';

/**
 * UsersAdminPanel - Panel de gestión de usuarios
 *
 * Funcionalidades:
 * - Listar todos los usuarios
 * - Buscar usuarios
 * - Crear nuevo usuario
 * - Editar perfil
 * - Cambiar rol
 * - Configurar managed_users
 * - Resetear contraseña
 * - Eliminar usuario
 */
function UsersAdminPanel() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [temporaryPasswordResult, setTemporaryPasswordResult] = useState(null);
  const [legacyDuplicatesHidden, setLegacyDuplicatesHidden] = useState(0);
  const { notify, confirm, FeedbackLayer } = useFeedbackLayer();

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    federation_id: '',
    role: 'player',
    managed_users: '',
  });

  // Cargar usuarios
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const rawUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const usersData = dedupeAdminUsers(rawUsers).sort((a, b) => (
        String(a.full_name || a.username || '').localeCompare(String(b.full_name || b.username || ''))
      ));
      setLegacyDuplicatesHidden(Math.max(0, rawUsers.length - usersData.length));
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      notify('Error al cargar usuarios: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Buscar usuarios
  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter(user =>
      user.username?.toLowerCase().includes(term) ||
      user.full_name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  // Crear usuario
  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.password) {
      notify('Por favor completa todos los campos requeridos.', 'warning');
      return;
    }

    if (formData.password.length < 6) {
      notify('La contraseña debe tener al menos 6 caracteres.', 'warning');
      return;
    }

    setLoading(true);

    let secondaryApp = null;
    let secondaryAuth = null;
    let createdAuthUser = null;

    try {
      const normalizedUsername = formData.username.trim().toLowerCase();
      const normalizedEmail = formData.email.trim().toLowerCase();
      const usernameRef = doc(db, 'usernames', normalizedUsername);
      const existingUsername = await getDoc(usernameRef);

      if (existingUsername.exists()) {
        const usernameError = new Error('Este username ya está en uso');
        usernameError.code = 'admin/username-already-in-use';
        throw usernameError;
      }

      secondaryApp = initializeFirebaseApp(
        firebaseConfig,
        `admin-user-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      );
      secondaryAuth = getAuth(secondaryApp);
      await setPersistence(secondaryAuth, inMemoryPersistence);

      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        normalizedEmail,
        formData.password
      );

      const uid = userCredential.user.uid;
      createdAuthUser = userCredential.user;

      // Crear documento en Firestore
      await setDoc(doc(db, 'users', uid), {
        username: normalizedUsername,
        uid: uid,
        email: normalizedEmail,
        full_name: formData.full_name || formData.username,
        federation_id: formData.federation_id || null,
        role: formData.role,
        managed_users: normalizeManagedUsers(formData.managed_users),
        created_at: new Date().toISOString(),
        created_by_admin: true
      });

      // Crear mapping username -> uid
      await setDoc(usernameRef, {
        uid: uid,
        username: normalizedUsername,
        updated_at: new Date()
      });

      notify(`Usuario "${formData.username}" creado correctamente.`, 'success');
      setIsCreatingUser(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        full_name: '',
        federation_id: '',
        role: 'player',
        managed_users: '',
      });

      loadUsers();
    } catch (error) {
      if (createdAuthUser) {
        try {
          await deleteUser(createdAuthUser);
        } catch (rollbackError) {
          console.error('Error rolling back auth user after failure:', rollbackError);
        }
      }

      console.error('Error creating user:', error);
      let errorMsg = error.message;

      if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'Este email ya está en uso';
      } else if (error.code === 'admin/username-already-in-use') {
        errorMsg = 'Este username ya está en uso';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'Email inválido';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'Contraseña débil (mínimo 6 caracteres)';
      }

      notify('Error al crear usuario: ' + errorMsg, 'error');
    } finally {
      if (secondaryAuth) {
        try {
          await secondaryAuth.signOut();
        } catch (signOutError) {
          console.error('Error signing out secondary auth app:', signOutError);
        }
      }

      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (deleteAppError) {
          console.error('Error cleaning up secondary Firebase app:', deleteAppError);
        }
      }

      setLoading(false);
    }
  };

  // Editar usuario
  const handleEditUser = async (e) => {
    e.preventDefault();

    if (!editingUser) return;

    const adminCount = users.filter((candidate) => candidate.role === 'admin').length;
    const isRemovingLastAdmin = (
      editingUser.role === 'admin' &&
      formData.role !== 'admin' &&
      adminCount <= 1
    );

    if (isRemovingLastAdmin) {
      notify('No puedes quitar el rol al ultimo administrador del sistema.', 'warning');
      return;
    }

    setLoading(true);

    try {
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        full_name: formData.full_name,
        federation_id: formData.federation_id,
        role: formData.role,
        managed_users: normalizeManagedUsers(formData.managed_users),
        updated_at: new Date().toISOString()
      });

      notify(`Usuario "${editingUser.username}" actualizado correctamente.`, 'success');
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      notify('Error al actualizar usuario: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (user) => {
    if (auth.currentUser?.uid === user.id) {
      notify('No puedes eliminar tu propio perfil desde el panel de administracion.', 'warning');
      return;
    }

    const adminCount = users.filter((candidate) => candidate.role === 'admin').length;
    if (user.role === 'admin' && adminCount <= 1) {
      notify('No puedes eliminar el ultimo administrador del sistema.', 'warning');
      return;
    }

    const shouldDelete = await confirm({
      title: 'Eliminar perfil',
      message: `Se eliminara el perfil de "${user.username}", sus resultados, torneos personalizados y preferencias. El usuario de Firebase Authentication debe borrarse aparte si quieres bloquear el login.`,
      confirmText: 'Eliminar perfil',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!shouldDelete) return;

    setLoading(true);

    try {
      for (const docId of user.relatedDocIds || [user.id]) {
        await deleteDoc(doc(db, 'users', docId));
      }

      // Eliminar mapping de username
      if (user.username) {
        await deleteDoc(doc(db, 'usernames', user.username));
      }

      notify(`Perfil de "${user.username}" eliminado correctamente.`, 'success');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      notify('Error al eliminar usuario: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Resetear contraseña
  const handleResetPassword = async (user) => {
    if (!user.email) {
      notify('Este usuario no tiene email configurado.', 'warning');
      return;
    }

    const shouldSend = await confirm({
      title: 'Enviar recuperacion',
      message: `Enviar email de recuperacion de contraseña a ${user.email}.`,
      confirmText: 'Enviar email',
      cancelText: 'Cancelar',
    });
    if (!shouldSend) return;

    try {
      await sendPasswordResetEmail(auth, user.email);
      notify(`Email enviado a ${user.email}.`, 'success');
    } catch (error) {
      console.error('Error sending reset email:', error);
      notify('Error al enviar email: ' + error.message, 'error');
    }
  };

  const generateTemporaryPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const symbols = '!@$%';
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);

    const body = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
    return `${body}${symbols[bytes[0] % symbols.length]}${(bytes[1] % 90) + 10}`;
  };

  const handleAssignTemporaryPassword = async (user) => {
    if (!user?.id || !user?.email) {
      notify('Este usuario no tiene uid/email suficiente para cambiar la contraseña.', 'warning');
      return;
    }

    if (!auth.currentUser) {
      notify('Debes estar autenticado como administrador.', 'warning');
      return;
    }

    const shouldAssign = await confirm({
      title: 'Asignar contraseña temporal',
      message: `Se cambiara la contraseña de @${user.username}. La contraseña anterior dejara de funcionar y se mostrara la nueva una sola vez.`,
      confirmText: 'Asignar temporal',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!shouldAssign) return;

    setLoading(true);
    const temporaryPassword = generateTemporaryPassword();

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(API_ENDPOINTS.setTempPassword, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: user.id,
          password: temporaryPassword,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo asignar la contraseña temporal.');
      }

      setTemporaryPasswordResult({
        username: user.username,
        email: user.email,
        password: temporaryPassword,
      });
      notify(`Contraseña temporal asignada a @${user.username}.`, 'success');
      loadUsers();
    } catch (error) {
      console.error('Error assigning temporary password:', error);
      notify('Error al asignar contraseña temporal: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      full_name: user.full_name || '',
      federation_id: user.federation_id || '',
      role: user.role || 'player',
      managed_users: Array.isArray(user.managed_users) ? user.managed_users.join(', ') : ''
    });
  };

  const normalizeManagedUsers = (value) => (
    String(value || '')
      .split(',')
      .map((username) => username.trim().toLowerCase())
      .filter(Boolean)
  );

  const handleOpenUserArea = (targetUser) => {
    if (!targetUser?.username) return;
    navigate(`/?view_as=${encodeURIComponent(targetUser.username)}`);
  };

  if (loading && users.length === 0) {
    return (
      <>
        <FeedbackLayer />
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Cargando usuarios...</p>
        </div>
      </>
    );
  }

  return (
    <div>
      <FeedbackLayer />
      {/* Header con búsqueda y botón crear */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Buscar por nombre, email o username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 0.75rem 0.75rem 2.5rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.9rem'
            }}
          />
        </div>

        <button
          onClick={() => {
            setIsCreatingUser(true);
            setFormData({
              username: '',
              email: '',
              password: '',
              full_name: '',
              federation_id: '',
              role: 'player',
              managed_users: '',
            });
          }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <UserPlus size={18} />
          Crear Usuario
        </button>
      </div>

      {legacyDuplicatesHidden > 0 && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.9rem 1rem',
          borderRadius: '10px',
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          color: '#9a3412',
          fontSize: '0.9rem'
        }}>
          Se han ocultado {legacyDuplicatesHidden} documentos legacy duplicados de la migracion a Firebase. El panel ya muestra solo el perfil canonico por usuario.
        </div>
      )}

      {/* Lista de usuarios */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Usuario</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Email</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Rol</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Licencia</th>
              <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: '500', color: '#0f172a' }}>{user.full_name || user.username}</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>@{user.username}</div>
                  </div>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#64748b' }}>{user.email}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: user.role === 'admin' ? '#fee2e2' : user.role === 'manager' ? '#dbeafe' : '#f1f5f9',
                    color: user.role === 'admin' ? '#991b1b' : user.role === 'manager' ? '#1e40af' : '#475569'
                  }}>
                    {user.role || 'player'}
                  </span>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#64748b' }}>{user.federation_id || '-'}</td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleOpenUserArea(user)}
                      title={`Abrir la app como ${user.username}`}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #dbeafe',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}
                    >
                      <LogIn size={14} />
                      Entrar
                    </button>
                    <button
                      onClick={() => startEditUser(user)}
                      title="Editar usuario"
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Edit size={16} color="#64748b" />
                    </button>
                    <button
                      onClick={() => handleResetPassword(user)}
                      title="Resetear contraseña"
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Key size={16} color="#64748b" />
                    </button>
                    <button
                      onClick={() => handleAssignTemporaryPassword(user)}
                      title="Asignar contraseña temporal"
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #fed7aa',
                        background: '#fff7ed',
                        color: '#9a3412',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}
                    >
                      <Key size={14} />
                      Temporal
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      title="Eliminar usuario"
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #fee2e2',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
          </div>
        )}
      </div>

      {/* Modal: Crear Usuario */}
      {isCreatingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 1000,
          paddingTop: '3rem',
          overflowY: 'auto'
        }}>
          <div className="card fade-in" style={{ width: '90%', maxWidth: '500px', padding: '2rem', margin: '1rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Crear Nuevo Usuario</h2>

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                  placeholder="ej: juan_perez"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ej: juan@email.com"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Contraseña * (mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  required
                  minLength={6}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="ej: Juan Pérez"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Nº Licencia Federativa
                </label>
                <input
                  type="text"
                  value={formData.federation_id}
                  onChange={(e) => setFormData({ ...formData, federation_id: e.target.value })}
                  placeholder="ej: CB00123456"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  <Shield size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                >
                  <option value="player">Player (Jugador normal)</option>
                  <option value="manager">Manager (Gestiona otros perfiles)</option>
                  <option value="admin">Admin (Acceso total)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Usernames gestionados
                </label>
                <input
                  type="text"
                  value={formData.managed_users}
                  onChange={(e) => setFormData({ ...formData, managed_users: e.target.value })}
                  placeholder="ej: hijo1, hijo2"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  {loading ? 'Creando...' : 'Crear Usuario'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingUser(false)}
                  className="btn"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuario */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 1000,
          paddingTop: '3rem',
          overflowY: 'auto'
        }}>
          <div className="card fade-in" style={{ width: '90%', maxWidth: '500px', padding: '2rem', margin: '1rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Editar Usuario: @{editingUser.username}</h2>

            <form onSubmit={handleEditUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Nº Licencia Federativa
                </label>
                <input
                  type="text"
                  value={formData.federation_id}
                  onChange={(e) => setFormData({ ...formData, federation_id: e.target.value })}
                  placeholder="ej: CB00123456"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  <Shield size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                >
                  <option value="player">Player (Jugador normal)</option>
                  <option value="manager">Manager (Gestiona otros perfiles)</option>
                  <option value="admin">Admin (Acceso total)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                  Usernames gestionados
                </label>
                <input
                  type="text"
                  value={formData.managed_users}
                  onChange={(e) => setFormData({ ...formData, managed_users: e.target.value })}
                  placeholder="ej: hijo1, hijo2"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Contraseña temporal asignada */}
      {temporaryPasswordResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15,23,42,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card fade-in" style={{ width: '90%', maxWidth: '520px', padding: '2rem' }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.35rem' }}>Contraseña temporal creada</h2>
            <p style={{ margin: '0 0 1rem', color: '#64748b', lineHeight: 1.5 }}>
              Entrega esta contraseña a @{temporaryPasswordResult.username}. Se muestra aqui una sola vez; no se guarda en texto claro.
            </p>

            <div style={{
              padding: '1rem',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>
                Email
              </div>
              <div style={{ fontWeight: '700', marginBottom: '0.85rem' }}>
                {temporaryPasswordResult.email}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>
                Contraseña temporal
              </div>
              <code style={{
                display: 'block',
                padding: '0.85rem',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: '1rem',
                letterSpacing: '0.04em',
                userSelect: 'all',
                overflowX: 'auto'
              }}>
                {temporaryPasswordResult.password}
              </code>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(temporaryPasswordResult.password);
                    notify('Contraseña temporal copiada.', 'success');
                  } catch (error) {
                    console.error('Error copying temporary password:', error);
                    notify('No se pudo copiar automaticamente.', 'warning');
                  }
                }}
              >
                Copiar contraseña
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setTemporaryPasswordResult(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersAdminPanel;

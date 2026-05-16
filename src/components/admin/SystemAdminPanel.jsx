import { useState } from 'react';
import { Trash2, RefreshCw, Database, AlertCircle } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { dedupeAdminUsers } from '../../utils/adminUserRecords';
import { useFeedbackLayer } from '../FeedbackLayer';

/**
 * SystemAdminPanel - Utilidades del sistema
 */
function SystemAdminPanel() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const { notify, confirm, FeedbackLayer } = useFeedbackLayer();

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const handleClearAllCaches = async () => {
    const shouldClear = await confirm({
      title: 'Limpiar caches',
      message: 'Esto borrara todos los caches de handicap del dispositivo admin actual.',
      confirmText: 'Limpiar caches',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!shouldClear) return;

    setLoading(true);
    addLog('Iniciando limpieza de caches...', 'info');

    try {
      // Limpiar localStorage (esto solo afecta al admin actual)
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('golf_tracker_handicap_cache_')) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));

      addLog(`✅ ${keysToRemove.length} caches locales eliminados`, 'success');
      notify('Caches locales limpiados correctamente.', 'success');
    } catch (error) {
      console.error('Error clearing caches:', error);
      addLog(`❌ Error: ${error.message}`, 'error');
      notify('Error al limpiar caches: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateUsernameMappings = async () => {
    const shouldRegenerate = await confirm({
      title: 'Regenerar mappings',
      message: 'Esto regenerara el mapping de usernames a uid para todos los usuarios. Es util si hay inconsistencias.',
      confirmText: 'Regenerar',
      cancelText: 'Cancelar',
    });
    if (!shouldRegenerate) return;

    setLoading(true);
    addLog('Regenerando mappings de usernames...', 'info');

    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const rawUsers = usersSnapshot.docs.map((userDoc) => ({
        id: userDoc.id,
        ...userDoc.data()
      }));
      const usersData = dedupeAdminUsers(rawUsers);
      let count = 0;

      for (const userData of usersData) {
        const uid = userData.id;
        const username = userData.username;

        if (username) {
          await setDoc(doc(db, 'usernames', username), {
            uid: uid,
            username: username,
            updated_at: new Date()
          });
          count++;
          addLog(`Mapping creado: ${username} → ${uid}`, 'info');
        }
      }

      addLog(`✅ ${count} mappings regenerados correctamente`, 'success');
      notify(`${count} mappings regenerados correctamente.`, 'success');
    } catch (error) {
      console.error('Error regenerating mappings:', error);
      addLog(`❌ Error: ${error.message}`, 'error');
      notify('Error al regenerar mappings: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrphanedData = async () => {
    const shouldContinue = await confirm({
      title: 'Datos huerfanos',
      message: 'Esta funcionalidad esta deshabilitada por seguridad y requiere operacion manual en Firebase Console.',
      confirmText: 'Entendido',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!shouldContinue) return;

    addLog('Esta funcionalidad está deshabilitada por seguridad', 'warning');
    notify('Por seguridad, requiere implementacion manual en Firebase Console.', 'warning');
  };

  return (
    <div>
      <FeedbackLayer />
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#0f172a' }}>
        Utilidades del Sistema
      </h2>

      {/* Warning Banner */}
      <div style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '0.75rem'
      }}>
        <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.25rem', color: '#991b1b' }}>
            ⚠️ Precaución
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#991b1b', margin: 0, lineHeight: '1.5' }}>
            Las operaciones en esta sección pueden afectar a toda la base de datos.
            Asegúrate de tener un backup antes de ejecutar operaciones destructivas.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} />
                Limpiar Caches de Hándicap
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
                Elimina todos los caches de hándicap almacenados localmente. Los usuarios volverán a descargar su hándicap la próxima vez que entren.
              </p>
            </div>
            <button
              onClick={handleClearAllCaches}
              disabled={loading}
              className="btn"
              style={{ marginLeft: '1rem', whiteSpace: 'nowrap' }}
            >
              {loading ? 'Limpiando...' : 'Limpiar Caches'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={18} />
                Regenerar Mappings de Usernames
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
                Reconstruye la colección <code>usernames/</code> a partir de todos los usuarios en <code>users/</code>. Útil para resolver inconsistencias.
              </p>
            </div>
            <button
              onClick={handleRegenerateUsernameMappings}
              disabled={loading}
              className="btn"
              style={{ marginLeft: '1rem', whiteSpace: 'nowrap' }}
            >
              {loading ? 'Regenerando...' : 'Regenerar Mappings'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', opacity: 0.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} />
                Limpiar Datos Huérfanos
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
                Busca y elimina resultados sin usuario, torneos duplicados, etc. <strong>Deshabilitado por seguridad.</strong>
              </p>
            </div>
            <button
              onClick={handleDeleteOrphanedData}
              disabled={true}
              className="btn"
              style={{ marginLeft: '1rem', whiteSpace: 'nowrap', opacity: 0.5 }}
            >
              Deshabilitado
            </button>
          </div>
        </div>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}>
              Logs de Operaciones
            </h3>
            <button
              onClick={() => setLogs([])}
              className="btn"
              style={{ fontSize: '0.85rem' }}
            >
              Limpiar Logs
            </button>
          </div>

          <div style={{
            background: '#0f172a',
            borderRadius: '8px',
            padding: '1rem',
            maxHeight: '300px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem'
          }}>
            {logs.map((log, index) => (
              <div
                key={index}
                style={{
                  color: log.type === 'error' ? '#fca5a5' : log.type === 'success' ? '#86efac' : log.type === 'warning' ? '#fde047' : '#e2e8f0',
                  marginBottom: '0.25rem'
                }}
              >
                <span style={{ opacity: 0.6 }}>[{log.timestamp}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: '#f8fafc',
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: '#64748b',
        lineHeight: '1.6'
      }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#0f172a' }}>
          💡 Backups Recomendados
        </h4>
        <p style={{ margin: '0.5rem 0' }}>
          Antes de ejecutar operaciones que modifiquen datos masivamente, asegúrate de:
        </p>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
          <li>Exportar usuarios desde Firebase Console → Firestore → Export</li>
          <li>Exportar reglas de seguridad desde Firestore → Rules</li>
          <li>Tener un backup reciente de la base de datos</li>
        </ul>
      </div>
    </div>
  );
}

export default SystemAdminPanel;

import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Flag, RefreshCw } from 'lucide-react';
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useFeedbackLayer } from '../FeedbackLayer';

function formatDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return 'Fecha pendiente';

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getDisplayName(user) {
  return user?.full_name || user?.username || user?.uid || 'Usuario';
}

function ChatReportsAdminPanel({ user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const { notify, confirm, FeedbackLayer } = useFeedbackLayer();

  const loadReports = async () => {
    setLoading(true);
    try {
      const reportsQuery = query(collection(db, 'chat_reports'), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(reportsQuery);
      setReports(snapshot.docs.map((reportDoc) => ({
        id: reportDoc.id,
        ...reportDoc.data(),
      })));
    } catch (error) {
      console.error('[admin] Could not load chat reports:', error);
      notify('No se pudieron cargar los reportes: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const filteredReports = useMemo(() => (
    reports.filter((report) => {
      if (statusFilter === 'all') return true;
      return (report.status || 'open') === statusFilter;
    })
  ), [reports, statusFilter]);

  const counts = useMemo(() => ({
    open: reports.filter((report) => (report.status || 'open') === 'open').length,
    reviewed: reports.filter((report) => report.status === 'reviewed').length,
    dismissed: reports.filter((report) => report.status === 'dismissed').length,
  }), [reports]);

  const updateReportStatus = async (report, status) => {
    if (!report?.id) return;
    setWorkingId(report.id);
    try {
      await updateDoc(doc(db, 'chat_reports', report.id), {
        status,
        reviewed_at: serverTimestamp(),
        reviewed_by: user?.username || user?.uid || 'admin',
        updated_at: serverTimestamp(),
      });
      notify(status === 'reviewed' ? 'Reporte marcado como revisado.' : 'Reporte descartado.', 'success');
      await loadReports();
    } catch (error) {
      console.error('[admin] Could not update chat report:', error);
      notify('No se pudo actualizar el reporte: ' + error.message, 'error');
    } finally {
      setWorkingId('');
    }
  };

  const blockReportedChat = async (report) => {
    if (!report?.chat_id) return;

    const shouldBlock = await confirm({
      title: 'Bloquear chat',
      message: `Esto bloqueara el chat reportado entre ${getDisplayName(report.reporter_user)} y ${getDisplayName(report.reported_user)}. No podran enviarse nuevos mensajes en esta conversacion.`,
      confirmText: 'Bloquear chat',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!shouldBlock) return;

    setWorkingId(report.id);
    try {
      await updateDoc(doc(db, 'chats', report.chat_id), {
        blocked_by: arrayUnion('admin'),
        admin_blocked_at: serverTimestamp(),
        admin_blocked_by: user?.username || user?.uid || 'admin',
        updated_at: serverTimestamp(),
      });
      await updateDoc(doc(db, 'chat_reports', report.id), {
        status: 'reviewed',
        action_taken: 'chat_blocked',
        reviewed_at: serverTimestamp(),
        reviewed_by: user?.username || user?.uid || 'admin',
        updated_at: serverTimestamp(),
      });
      notify('Chat bloqueado y reporte marcado como revisado.', 'success');
      await loadReports();
    } catch (error) {
      console.error('[admin] Could not block reported chat:', error);
      notify('No se pudo bloquear el chat: ' + error.message, 'error');
    } finally {
      setWorkingId('');
    }
  };

  if (loading && reports.length === 0) {
    return (
      <>
        <FeedbackLayer />
        <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando reportes de chat...</div>
      </>
    );
  }

  return (
    <div>
      <FeedbackLayer />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 0.4rem', color: '#0f172a' }}>
            Moderación de Chat
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            Revisa conversaciones reportadas y bloquea chats cuando sea necesario.
          </p>
        </div>
        <button type="button" className="btn" onClick={loadReports} disabled={loading}>
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[
          { id: 'open', label: `Abiertos (${counts.open})` },
          { id: 'reviewed', label: `Revisados (${counts.reviewed})` },
          { id: 'dismissed', label: `Descartados (${counts.dismissed})` },
          { id: 'all', label: `Todos (${reports.length})` },
        ].map((filter) => {
          const active = statusFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={active ? 'btn btn-primary' : 'btn'}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {filteredReports.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          No hay reportes en este filtro.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filteredReports.map((report) => {
            const status = report.status || 'open';
            const busy = workingId === report.id;
            return (
              <div key={report.id} className="card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <Flag size={18} color="#c2410c" />
                      <strong style={{ color: '#0f172a' }}>
                        {getDisplayName(report.reporter_user)} reportó a {getDisplayName(report.reported_user)}
                      </strong>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      {formatDate(report.created_at)} · Chat: <code>{report.chat_id}</code>
                    </div>
                  </div>
                  <span style={{
                    alignSelf: 'flex-start',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '999px',
                    background: status === 'open' ? '#fff7ed' : status === 'reviewed' ? '#ecfdf5' : '#f1f5f9',
                    color: status === 'open' ? '#c2410c' : status === 'reviewed' ? '#166534' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                  }}>
                    {status}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.75rem',
                }}>
                  <div style={{ padding: '0.85rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontWeight: 900, color: '#334155', marginBottom: '0.25rem' }}>Motivo</div>
                    <div style={{ color: '#475569', overflowWrap: 'anywhere' }}>{report.reason || 'Sin motivo detallado.'}</div>
                  </div>
                  <div style={{ padding: '0.85rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontWeight: 900, color: '#334155', marginBottom: '0.25rem' }}>Último mensaje guardado</div>
                    <div style={{ color: '#475569', overflowWrap: 'anywhere' }}>
                      {report.last_message?.text || 'Sin último mensaje.'}
                    </div>
                  </div>
                </div>

                {report.reviewed_by && (
                  <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    Revisado por {report.reviewed_by} · {formatDate(report.reviewed_at)}
                    {report.action_taken ? ` · Acción: ${report.action_taken}` : ''}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => updateReportStatus(report, 'reviewed')}
                    disabled={busy || status === 'reviewed'}
                  >
                    <CheckCircle2 size={16} />
                    Marcar revisado
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => updateReportStatus(report, 'dismissed')}
                    disabled={busy || status === 'dismissed'}
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => blockReportedChat(report)}
                    disabled={busy}
                    style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fff' }}
                  >
                    <Ban size={16} />
                    Bloquear chat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ChatReportsAdminPanel;

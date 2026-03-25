/**
 * ProfileModal Component
 *
 * Modal dialog for editing user profile: name, email, federation ID.
 * Also provides legacy data recovery and hard reset.
 */

import { X } from 'lucide-react';

/**
 * @param {{
 *   user: object,
 *   isOpen: boolean,
 *   onClose: Function,
 *   fullName: string,
 *   setFullName: Function,
 *   email: string,
 *   setEmail: Function,
 *   federationId: string,
 *   setFederationId: Function,
 *   isUpdating: boolean,
 *   onSubmit: Function,
 *   onRecoverProfile: Function,
 *   onHardReset: Function,
 * }} props
 */
export default function ProfileModal({
  user,
  isOpen,
  onClose,
  fullName,
  setFullName,
  email,
  setEmail,
  federationId,
  setFederationId,
  isUpdating,
  onSubmit,
  onRecoverProfile,
  onHardReset,
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, paddingTop: '5rem', overflowY: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card fade-in" style={{ width: '90%', maxWidth: '400px', padding: '2rem' }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Editar Perfil</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nombre Completo
            </label>
            <input
              type="text"
              placeholder="Tu nombre completo"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #E5E1DE', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email (Opcional)
            </label>
            <input
              type="email"
              placeholder="ejemplo@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #E5E1DE', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nº Licencia (Federado)
            </label>
            <input
              type="text"
              placeholder="Ej: CB00123456"
              value={federationId}
              onChange={e => setFederationId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #E5E1DE', boxSizing: 'border-box' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
              El nº de licencia se utiliza para cargar tu hándicap oficial automáticamente.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '1rem' }}
            disabled={isUpdating}
          >
            {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
          </button>

          <button
            type="button"
            className="btn"
            onClick={onRecoverProfile}
            style={{ width: '100%', background: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.2)', fontSize: '0.85rem' }}
          >
            🔄 Restaurar Foto y Datos (Legacy)
          </button>

          {/* ── Danger zone ──────────────────────────────────────────────── */}
          <div style={{ marginTop: '2rem', borderTop: '1px dashed #E5E1DE', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '10px' }}>
              ¿Problemas con el perfil? Prueba a limpiar la app:
            </p>
            <button
              type="button"
              onClick={onHardReset}
              style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Borrar caché y resetear aplicación
            </button>
            <p style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '5px', opacity: 0.5 }}>
              ID: {user?.username} | Photo: {String(user?.photo_url || '').substring(0, 20)}...
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

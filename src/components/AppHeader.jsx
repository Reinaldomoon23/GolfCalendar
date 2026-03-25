/**
 * AppHeader Component
 *
 * The main app header containing: top bar actions (update/logout),
 * user avatar(s), profile edit button, season selector, admin banner,
 * and the handicap action buttons.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, User, Shield, LogOut, Camera } from 'lucide-react';
import ProfileImage from './ProfileImage';
import { IS_MULTI } from '../config/app';

/**
 * @param {{
 *   user: object,
 *   sessionOwner: object|null,
 *   linkedUsers: object[],
 *   photoVersion: number,
 *   isUploadingPhoto: boolean,
 *   handicap: string|null,
 *   pdfUrl: string|null,
 *   isUpdatingHandicap: boolean,
 *   currentSeason: string,
 *   availableSeasons: string[],
 *   onSeasonChange: Function,
 *   onPhotoUpload: Function,
 *   onOpenProfileModal: Function,
 *   onSwitchUser: Function,
 *   onReturnToOwner: Function,
 *   onHandicapClick: Function,
 *   onOpenPdf: Function,
 *   onAppUpdate: Function,
 *   onLogout: Function,
 * }} props
 */
export default function AppHeader({
  user,
  sessionOwner,
  linkedUsers,
  photoVersion,
  isUploadingPhoto,
  handicap,
  pdfUrl,
  isUpdatingHandicap,
  currentSeason,
  availableSeasons,
  onSeasonChange,
  onPhotoUpload,
  onOpenProfileModal,
  onSwitchUser,
  onReturnToOwner,
  onHandicapClick,
  onOpenPdf,
  onAppUpdate,
  onLogout,
}) {
  const fileInputRef = useRef(null);
  const handlePhotoClick = () => fileInputRef.current?.click();

  const isAdminViewingOther = IS_MULTI && sessionOwner?.role === 'admin' && user?.username !== sessionOwner?.username;

  return (
    <header className="app-header" style={{ position: 'relative' }}>
      {/* ── Top bar: Refresh + Logout ─────────────────────────────────────── */}
      {IS_MULTI && (
        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: '0.5rem', padding: '0.5rem', zIndex: 100 }}>
          <button
            onClick={onAppUpdate}
            style={{
              background: 'rgba(255,255,255,0.85)', border: '1px solid #e2e8f0', cursor: 'pointer',
              color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
            title="Recargar/Actualizar la App"
          >
            ↻
          </button>
          <button
            onClick={onLogout}
            className="btn"
            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
            title="Cerrar Sesión"
          >
            <LogOut size={24} />
          </button>
        </div>
      )}

      {/* ── Avatar section ────────────────────────────────────────────────── */}
      {linkedUsers.length > 0 ? (
        /* Manager mode: show all linked avatars */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.7)', padding: '6px', borderRadius: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ position: 'relative' }}>
              <ProfileImage
                key={`photo-${photoVersion}`}
                photoPath={user.photo_url}
                displayName={user.full_name || user.username}
                version={photoVersion}
                alt={user.full_name}
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary)' }}
              />
            </div>
            {linkedUsers.filter(u => u.username !== user.username).map(u => (
              <div
                key={u.username}
                onClick={() => onSwitchUser(u)}
                style={{ cursor: 'pointer', opacity: 0.6, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center' }}
                title={`Cambiar a ${u.full_name}`}
              >
                <ProfileImage
                  key={`nav-photo-${u.username}-${photoVersion}`}
                  photoPath={u.photo_url}
                  displayName={u.full_name || u.username}
                  version={photoVersion}
                  alt={u.full_name}
                  style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid transparent' }}
                />
              </div>
            ))}
          </div>
          <h1 className="app-title" style={{ fontSize: '1.8rem', marginTop: '0.5rem', marginBottom: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {user.full_name}
            <button
              onClick={onOpenProfileModal}
              style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-primary)', opacity: 0.6, display: 'flex', alignItems: 'center' }}
              title="Editar Perfil"
            >
              <User size={16} />
            </button>
          </h1>
        </div>
      ) : (
        /* Single user mode: large clickable avatar */
        <div style={{ padding: '20px 0 10px 0', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={onPhotoUpload}
          />
          <div
            onClick={handlePhotoClick}
            style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}
            title="Cambiar foto de perfil"
          >
            <ProfileImage
              key={`edit-photo-${photoVersion}`}
              photoPath={user.photo_url}
              displayName={user.full_name || user.username}
              version={photoVersion}
              alt={user.full_name}
              style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
            />
            {isUploadingPhoto && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <TrendingUp className="spin-animation" size={24} />
              </div>
            )}
            {!isUploadingPhoto && (
              <div style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'var(--color-primary)', color: 'white', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                <Camera size={18} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Name + edit button (single user only) ─────────────────────────── */}
      {linkedUsers.length === 0 && (
        <h1 className="app-title">
          {user.full_name || 'RoundTracker'}
          {IS_MULTI && (
            <button
              onClick={onOpenProfileModal}
              style={{ background: 'none', border: 'none', padding: '4px', marginLeft: '10px', cursor: 'pointer', color: 'var(--color-primary)', verticalAlign: 'middle', opacity: 0.6, transition: 'opacity 0.2s' }}
              title="Editar Perfil"
            >
              <User size={20} />
            </button>
          )}
        </h1>
      )}

      {/* ── Season selector ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>Temporada</span>
        <select
          value={currentSeason}
          onChange={(e) => onSeasonChange(e.target.value)}
          style={{ background: 'transparent', border: '1px solid transparent', borderBottom: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontWeight: '600', fontSize: '1rem', cursor: 'pointer', padding: '0 4px', textAlign: 'center', appearance: 'none', WebkitAppearance: 'none' }}
        >
          {availableSeasons.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.8em', opacity: 0.7, color: 'var(--color-text-muted)' }}>(v2.4.8)</span>
      </div>

      {/* ── Admin "viewing as" banner ─────────────────────────────────────── */}
      {isAdminViewingOther && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', borderRadius: '999px', background: 'rgba(15, 23, 42, 0.06)', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Viendo como <strong style={{ color: 'var(--color-primary-dark)' }}>{user.full_name || user.username}</strong>
            </span>
            <button
              onClick={onReturnToOwner}
              style={{ border: 'none', background: '#0f172a', color: 'white', borderRadius: '999px', padding: '0.45rem 0.9rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
            >
              Volver a mi usuario
            </button>
          </div>
        </div>
      )}

      {/* ── Action buttons: Admin + Handicap + PDF ────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '12px' }}>
        {IS_MULTI && sessionOwner?.role === 'admin' && (
          <Link to="/admin" style={{ textDecoration: 'none' }}>
            <button
              className="handicap-btn fade-in"
              title="Ir al panel de administración"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#0f172a', color: 'white', padding: '8px 18px', borderRadius: '24px', fontSize: '0.95rem', fontWeight: '600', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <Shield size={16} />
              Admin
            </button>
          </Link>
        )}

        <button
          className="handicap-btn fade-in"
          onClick={onHandicapClick}
          title="Actualizar hándicap"
          disabled={isUpdatingHandicap || !user?.username}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', padding: '8px 24px', borderRadius: '24px', fontSize: '1.1rem', fontWeight: '600', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.05)', cursor: isUpdatingHandicap || !user?.username ? 'default' : 'pointer', transition: 'all 0.2s ease', width: '220px', maxWidth: '75vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <TrendingUp size={18} className={isUpdatingHandicap ? 'spin-animation' : ''} />
          <span>{isUpdatingHandicap ? 'Actualizando...' : (handicap ? `Hándicap: ${String(handicap).substring(0, 15)}` : 'Actualizar hándicap')}</span>
        </button>

        {pdfUrl && (
          <button
            className="handicap-btn fade-in"
            onClick={onOpenPdf}
            title="Abrir PDF del hándicap"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '999px', border: '1px solid rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.7)', color: 'var(--color-primary-dark)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer' }}
          >
            PDF
          </button>
        )}
      </div>
    </header>
  );
}

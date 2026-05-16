import { useState } from 'react';
import { Shield, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useFeedbackLayer } from '../FeedbackLayer';

/**
 * SecurityAdminPanel - Panel de seguridad
 *
 * Permite gestionar reglas de Firestore e índices
 */
function SecurityAdminPanel() {
  const [rulesStatus] = useState('restrictive');
  const { notify, FeedbackLayer } = useFeedbackLayer();

  const firestoreRulesTemplate = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function userDocExists(uid) {
      return exists(/databases/${'${'}database}/documents/users/${'${'}uid});
    }

    function getUserProfile(uid) {
      return get(/databases/${'${'}database}/documents/users/${'${'}uid}).data;
    }

    function isOwner(uid) {
      return isAuthenticated() && request.auth.uid == uid;
    }

    function isAdmin() {
      return isAuthenticated() &&
        userDocExists(request.auth.uid) &&
        getUserProfile(request.auth.uid).role == 'admin';
    }

    function isManagerOf(targetUsername) {
      return isAuthenticated() &&
        userDocExists(request.auth.uid) &&
        getUserProfile(request.auth.uid).managed_users != null &&
        targetUsername in getUserProfile(request.auth.uid).managed_users;
    }

    function canAccessUser(targetUid) {
      return isOwner(targetUid) ||
        (userDocExists(targetUid) &&
         isManagerOf(getUserProfile(targetUid).username));
    }

    function isOwnerCreatingProfile(userId) {
      return isOwner(userId) &&
        request.resource.data.uid == request.auth.uid &&
        request.resource.data.role == 'player' &&
        request.resource.data.managed_users is list &&
        request.resource.data.managed_users.size() == 0;
    }

    function isOwnerProfileUpdate(userId) {
      return isOwner(userId) &&
        request.resource.data.uid == resource.data.uid &&
        request.resource.data.username == resource.data.username &&
        request.resource.data.role == resource.data.role &&
        request.resource.data.managed_users == resource.data.managed_users &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'full_name',
          'federation_id',
          'email',
          'photo_url',
          'handicap_url',
          'current_handicap',
          'handicap_pdf_url',
          'handicap_fetched_at',
          'updated_at'
        ]);
    }

    match /users/{uid} {
      allow read: if isAdmin() || canAccessUser(uid);
      allow create: if isAdmin() || isOwnerCreatingProfile(uid);
      allow update: if isAdmin() || isOwnerProfileUpdate(uid);
      allow delete: if isAdmin();

      match /{subcollection}/{document=**} {
        allow read, write: if isAdmin() || canAccessUser(uid);
      }
    }

    match /usernames/{username} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    match /tournaments/{tournamentId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /system_config/{documentId} {
      allow read, write: if isAdmin();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(firestoreRulesTemplate);
    notify('Reglas copiadas. Pegalas en Firebase Console > Firestore > Rules.', 'success');
  };

  return (
    <div>
      <FeedbackLayer />
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#0f172a' }}>
        Seguridad de Firestore
      </h2>

      {/* Status Banner */}
      <div style={{
        background: rulesStatus === 'permissive' ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${rulesStatus === 'permissive' ? '#fecaca' : '#bbf7d0'}`,
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start'
      }}>
        {rulesStatus === 'permissive' ? (
          <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
        ) : (
          <CheckCircle size={24} color="#16a34a" style={{ flexShrink: 0 }} />
        )}
        <div>
          <h3 style={{
            fontSize: '0.95rem',
            fontWeight: '600',
            marginBottom: '0.25rem',
            color: rulesStatus === 'permissive' ? '#991b1b' : '#166534'
          }}>
            {rulesStatus === 'permissive' ? '⚠️ Reglas Permisivas (Modo Desarrollo)' : '✅ Reglas Restrictivas con soporte Admin'}
          </h3>
          <p style={{
            fontSize: '0.85rem',
            color: rulesStatus === 'permissive' ? '#991b1b' : '#166534',
            margin: 0,
            lineHeight: '1.5'
          }}>
            {rulesStatus === 'permissive'
              ? 'PELIGRO: Cualquier usuario puede leer/escribir cualquier dato. Solo usar en desarrollo.'
              : 'Los admins pueden gestionar dashboard completo; jugadores y managers siguen limitados a sus propios datos.'}
          </p>
        </div>
      </div>

      {/* Firestore Rules */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={20} />
            Reglas de Firestore (Producción)
          </h3>
          <button
            onClick={handleCopyRules}
            className="btn"
            style={{ fontSize: '0.85rem' }}
          >
            📋 Copiar Reglas
          </button>
        </div>

        <div style={{
          background: '#0f172a',
          borderRadius: '8px',
          padding: '1rem',
          overflowX: 'auto',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          color: '#e2e8f0',
          lineHeight: '1.6'
        }}>
          <pre style={{ margin: 0 }}>{firestoreRulesTemplate}</pre>
        </div>

        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#eff6ff',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#1e40af'
        }}>
          <strong>📝 Instrucciones:</strong>
          <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0 }}>
            <li>Copia las reglas haciendo clic en "Copiar Reglas"</li>
            <li>Ve a <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af', textDecoration: 'underline' }}>Firebase Console</a></li>
            <li>Firestore Database → Rules</li>
            <li>Pega las reglas y haz clic en "Publish"</li>
          </ol>
        </div>
      </div>

      {/* Índices de Firestore */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} />
          Índices de Firestore
        </h3>

        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>
          Los índices mejoran el rendimiento de las queries complejas. Firebase los crea automáticamente cuando detecta queries que los necesitan.
        </p>

        <div style={{
          padding: '1rem',
          background: '#f8fafc',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#64748b'
        }}>
          <strong>Índices recomendados:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.2rem', padding: 0 }}>
            <li>Collection: <code>results</code> → Fields: <code>created_at (desc), tournament_id (asc)</code></li>
            <li>Collection: <code>custom_tournaments</code> → Fields: <code>dates (desc)</code></li>
          </ul>
        </div>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ display: 'inline-block', textDecoration: 'none' }}
          >
            Abrir Firebase Console
          </a>
        </div>
      </div>
    </div>
  );
}

export default SecurityAdminPanel;

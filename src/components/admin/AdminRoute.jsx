import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { fetchUserProfileByUid } from '../../utils/userProfiles';

/**
 * AdminRoute - Componente de protección de rutas de administración
 *
 * Solo permite acceso a usuarios con role: "admin"
 */
function AdminRoute({ user, children }) {
  const [authAdminStatus, setAuthAdminStatus] = useState(() => (
    user?.role === 'admin' ? 'admin' : 'checking'
  ));

  useEffect(() => {
    let cancelled = false;

    const resolveAdminAccess = async () => {
      if (user?.role === 'admin') {
        if (!cancelled) setAuthAdminStatus('admin');
        return;
      }

      const authUser = auth.currentUser;
      if (!authUser) {
        if (!cancelled) setAuthAdminStatus('blocked');
        return;
      }

      try {
        const ownerProfile = await fetchUserProfileByUid(db, authUser.uid, authUser.email);
        if (!cancelled) {
          setAuthAdminStatus(ownerProfile?.role === 'admin' ? 'admin' : 'blocked');
        }
      } catch (error) {
        console.error('Error resolving admin permissions:', error);
        if (!cancelled) {
          setAuthAdminStatus('blocked');
        }
      }
    };

    void resolveAdminAccess();

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  // Verificar que el usuario esté autenticado
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (authAdminStatus === 'checking') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div className="card" style={{ maxWidth: '500px', padding: '2rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>Verificando permisos</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            Comprobando si la sesion autenticada tiene acceso de administrador.
          </p>
        </div>
      </div>
    );
  }

  // Verificar que el usuario autenticado tenga rol de admin
  if (authAdminStatus !== 'admin') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div className="card" style={{ maxWidth: '500px', padding: '2rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</h1>
          <h2 style={{ marginBottom: '1rem' }}>Acceso Denegado</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            No tienes permisos de administrador para acceder a esta sección.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="btn btn-primary"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  // Usuario es admin, permitir acceso
  return children;
}
export default AdminRoute;

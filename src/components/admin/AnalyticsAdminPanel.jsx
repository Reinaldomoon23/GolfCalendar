import { useState, useEffect } from 'react';
import { Users, Trophy, TrendingUp, Calendar } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { dedupeAdminUsers } from '../../utils/adminUserRecords';

/**
 * AnalyticsAdminPanel - Panel de Analytics y métricas
 */
function AnalyticsAdminPanel() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTournaments: 0,
    totalResults: 0,
    activeUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);

    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const rawUsers = usersSnapshot.docs.map((userDoc) => ({
        id: userDoc.id,
        ...userDoc.data()
      }));
      const usersData = dedupeAdminUsers(rawUsers);
      const totalUsers = usersData.length;

      // Total torneos
      const tournamentsSnapshot = await getDocs(collection(db, 'tournaments'));
      const totalTournaments = tournamentsSnapshot.size;

      // Total resultados (aproximado - contando subcolecciones)
      let totalResults = 0;
      for (const userRecord of usersData) {
        const resultsSnapshot = await getDocs(collection(db, 'users', userRecord.id, 'results'));
        totalResults += resultsSnapshot.size;
      }

      setStats({
        totalUsers,
        totalTournaments,
        totalResults,
        activeUsers: totalUsers // Simplificado - podríamos filtrar por last_login
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando estadísticas...</div>;
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#0f172a' }}>
        Métricas y Analytics
      </h2>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '10px', background: '#dbeafe' }}>
              <Users size={24} color="#1e40af" />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a' }}>{stats.totalUsers}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Usuarios Totales</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '10px', background: '#fef3c7' }}>
              <Trophy size={24} color="#d97706" />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a' }}>{stats.totalTournaments}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Torneos Oficiales</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '10px', background: '#dcfce7' }}>
              <Calendar size={24} color="#166534" />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a' }}>{stats.totalResults}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Resultados Guardados</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '10px', background: '#e0e7ff' }}>
              <TrendingUp size={24} color="#4f46e5" />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a' }}>{stats.activeUsers}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Usuarios Activos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder para gráficos futuros */}
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#0f172a' }}>
          📊 Gráficos de Uso
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>
          Próximamente: Gráficos de crecimiento de usuarios, torneos más populares, y estadísticas avanzadas
        </p>
        <button
          onClick={loadStats}
          className="btn btn-primary"
        >
          Actualizar Estadísticas
        </button>
      </div>
    </div>
  );
}

export default AnalyticsAdminPanel;

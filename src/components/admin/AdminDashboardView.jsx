import { useState } from 'react';
import { Users, Trophy, BarChart3, Lock, Flag, Settings, MessageSquareWarning, UserRoundCog } from 'lucide-react';
import UsersAdminPanel from './UsersAdminPanel';
import TournamentsAdminPanel from './TournamentsAdminPanel';
import FeatureFlagsPanel from './FeatureFlagsPanel';
import AnalyticsAdminPanel from './AnalyticsAdminPanel';
import SecurityAdminPanel from './SecurityAdminPanel';
import SystemAdminPanel from './SystemAdminPanel';
import ChatReportsAdminPanel from './ChatReportsAdminPanel';
import CommunityAdminPanel from './CommunityAdminPanel';

/**
 * AdminDashboardView - Panel principal de administración
 *
 * Permite gestionar:
 * - Usuarios
 * - Torneos
 * - Feature Flags
 * - Analytics
 * - Moderación de chat
 * - Seguridad (Firestore rules + índices)
 * - Sistema (utilidades)
 */
function AdminDashboardView({ user }) {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'tournaments', label: 'Torneos', icon: Trophy },
    { id: 'flags', label: 'Feature Flags', icon: Flag },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'community', label: 'Comunidad', icon: UserRoundCog },
    { id: 'chat-reports', label: 'Chat', icon: MessageSquareWarning },
    { id: 'security', label: 'Seguridad', icon: Lock },
    { id: 'system', label: 'Sistema', icon: Settings },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#0f172a' }}>
            🛡️ Panel de Administración
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Bienvenido, <strong>{user?.full_name || user?.username}</strong>
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '2rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem'
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  border: 'none',
                  background: isActive ? 'var(--color-primary)' : 'transparent',
                  color: isActive ? 'white' : '#64748b',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? '600' : '400',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="fade-in">
          {activeTab === 'users' && <UsersAdminPanel user={user} />}
          {activeTab === 'tournaments' && <TournamentsAdminPanel user={user} />}
          {activeTab === 'flags' && <FeatureFlagsPanel user={user} />}
          {activeTab === 'analytics' && <AnalyticsAdminPanel user={user} />}
          {activeTab === 'community' && <CommunityAdminPanel user={user} />}
          {activeTab === 'chat-reports' && <ChatReportsAdminPanel user={user} />}
          {activeTab === 'security' && <SecurityAdminPanel user={user} />}
          {activeTab === 'system' && <SystemAdminPanel user={user} />}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardView;

import { useState, useEffect } from 'react';
import { Flag, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import FEATURE_FLAGS, { getCategories } from '../../config/featureFlags';

/**
 * FeatureFlagsPanel - Panel de gestión de Feature Flags
 *
 * Permite habilitar/deshabilitar features sin redeployar código
 */
function FeatureFlagsPanel() {
  const [flags, setFlags] = useState(FEATURE_FLAGS);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [saving, setSaving] = useState(null);
  const categories = getCategories();

  useEffect(() => {
    const loadStoredFlags = async () => {
      try {
        const snapshot = await getDoc(doc(db, 'system_config', 'feature_flags'));
        if (!snapshot.exists()) return;

        const storedFlags = snapshot.data();
        const mergedFlags = Object.entries(FEATURE_FLAGS).reduce((acc, [featureName, defaultConfig]) => {
          acc[featureName] = {
            ...defaultConfig,
            ...(storedFlags?.[featureName] || {})
          };
          return acc;
        }, {});

        setFlags(mergedFlags);
      } catch (error) {
        console.error('Error loading feature flags:', error);
      }
    };

    void loadStoredFlags();
  }, []);

  const toggleFeature = async (featureName) => {
    setSaving(featureName);

    const newFlags = {
      ...flags,
      [featureName]: {
        ...flags[featureName],
        enabled: !flags[featureName].enabled
      }
    };

    setFlags(newFlags);

    // Guardar en Firestore (opcional - para persistencia)
    try {
      await setDoc(doc(db, 'system_config', 'feature_flags'), newFlags, { merge: true });
    } catch (error) {
      console.error('Error saving feature flags:', error);
    }

    setSaving(null);
  };

  const updateRollout = async (featureName, rollout) => {
    const newFlags = {
      ...flags,
      [featureName]: {
        ...flags[featureName],
        rollout: parseInt(rollout, 10)
      }
    };

    setFlags(newFlags);

    // Guardar en Firestore (opcional)
    try {
      await setDoc(doc(db, 'system_config', 'feature_flags'), newFlags, { merge: true });
    } catch (error) {
      console.error('Error saving rollout:', error);
    }
  };

  const getFlagsByCategory = () => {
    return Object.entries(flags).filter(([, feature]) => (
      selectedCategory === 'all' || feature.category === selectedCategory
    ));
  };

  return (
    <div>
      {/* Info Banner */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '0.75rem'
      }}>
        <AlertCircle size={20} color="#3b82f6" style={{ flexShrink: 0 }} />
        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.25rem', color: '#1e40af' }}>
            ¿Qué son los Feature Flags?
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#1e40af', margin: 0, lineHeight: '1.5' }}>
            Los feature flags permiten habilitar o deshabilitar funcionalidades de la app sin redeployar código.
            Puedes hacer rollouts graduales (ej: 25% de usuarios) y desactivar features problemáticas al instante.
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: selectedCategory === 'all' ? 'var(--color-primary)' : '#f1f5f9',
            color: selectedCategory === 'all' ? 'white' : '#64748b',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '500'
          }}
        >
          Todas
        </button>

        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: selectedCategory === category ? 'var(--color-primary)' : '#f1f5f9',
              color: selectedCategory === category ? 'white' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '500',
              textTransform: 'capitalize'
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Feature Flags List */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {getFlagsByCategory().map(([featureName, feature]) => (
          <div
            key={featureName}
            className="card"
            style={{
              padding: '1.5rem',
              border: feature.enabled ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
              opacity: saving === featureName ? 0.6 : 1
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#0f172a' }}>
                    {featureName}
                  </h3>

                  <span style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    background: feature.enabled ? '#dcfce7' : '#fee2e2',
                    color: feature.enabled ? '#166534' : '#991b1b'
                  }}>
                    {feature.enabled ? 'ACTIVA' : 'INACTIVA'}
                  </span>

                  <span style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: '500',
                    background: '#f1f5f9',
                    color: '#64748b'
                  }}>
                    {feature.code}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>
                  {feature.description}
                </p>

                {/* Rollout Slider */}
                {feature.enabled && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>
                        Rollout: {feature.rollout}%
                      </label>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {feature.rollout === 0 && 'Nadie lo ve'}
                        {feature.rollout > 0 && feature.rollout < 100 && 'Gradual'}
                        {feature.rollout === 100 && 'Todos lo ven'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={feature.rollout}
                      onChange={(e) => updateRollout(featureName, e.target.value)}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => toggleFeature(featureName)}
                disabled={saving === featureName}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: feature.enabled ? 'var(--color-primary)' : '#f1f5f9',
                  color: feature.enabled ? 'white' : '#64748b',
                  cursor: saving === featureName ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
                title={feature.enabled ? 'Desactivar' : 'Activar'}
              >
                {feature.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {getFlagsByCategory().length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          No hay features en esta categoría
        </div>
      )}

      {/* Legend */}
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
          💡 Cómo usar Feature Flags
        </h4>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
          <li>Las features <strong>inactivas</strong> no aparecen en la app para ningún usuario</li>
          <li>Las features <strong>activas con rollout 100%</strong> están visibles para todos</li>
          <li>Las features con <strong>rollout parcial</strong> (ej: 25%) se muestran solo a ese % de usuarios</li>
          <li>Los cambios aplican <strong>inmediatamente</strong> sin necesidad de redeployar</li>
        </ul>
      </div>
    </div>
  );
}

export default FeatureFlagsPanel;

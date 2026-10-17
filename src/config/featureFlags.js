/**
 * Feature Flags System
 *
 * Permite habilitar/deshabilitar funcionalidades sin redeployar código.
 *
 * Estructura:
 * - enabled: boolean - Si la feature está activa globalmente
 * - rollout: number (0-100) - Porcentaje de usuarios que ven la feature
 * - description: string - Descripción de la feature
 * - code: string - Código único de la feature (FF-XXX)
 */

export const FEATURE_FLAGS = {
  // ========================================
  // SISTEMA
  // ========================================
  ADMIN_DASHBOARD: {
    code: 'FF-SYS-001',
    enabled: true,
    rollout: 100,
    description: 'Panel de administración completo',
    category: 'system'
  },

  ANALYTICS_TRACKING: {
    code: 'FF-SYS-002',
    enabled: false,
    rollout: 0,
    description: 'Seguimiento con Firebase Analytics',
    category: 'system'
  },

  ERROR_MONITORING: {
    code: 'FF-SYS-003',
    enabled: false,
    rollout: 0,
    description: 'Monitoreo de errores con Sentry',
    category: 'system'
  },

  // ========================================
  // FUNCIONALIDADES SOCIALES
  // ========================================
  FRIENDS_SYSTEM: {
    code: 'FF-SOCIAL-001',
    enabled: false,
    rollout: 0,
    description: 'Sistema de amigos (enviar/aceptar solicitudes)',
    category: 'social'
  },

  SHARE_TOURNAMENTS: {
    code: 'FF-SOCIAL-002',
    enabled: false,
    rollout: 0,
    description: 'Compartir torneos personalizados con amigos',
    category: 'social'
  },

  COMPARE_STATS: {
    code: 'FF-SOCIAL-003',
    enabled: false,
    rollout: 0,
    description: 'Comparar estadísticas con otros jugadores',
    category: 'social'
  },

  // ========================================
  // CARACTERÍSTICAS PREMIUM
  // ========================================
  ADVANCED_STATS: {
    code: 'FF-PREMIUM-001',
    enabled: false,
    rollout: 0,
    description: 'Estadísticas avanzadas (strokes gained, etc.)',
    category: 'premium'
  },

  PDF_EXPORT: {
    code: 'FF-PREMIUM-002',
    enabled: false,
    rollout: 0,
    description: 'Exportar estadísticas a PDF',
    category: 'premium'
  },

  DARK_MODE: {
    code: 'FF-PREMIUM-003',
    enabled: false,
    rollout: 0,
    description: 'Modo oscuro',
    category: 'premium'
  },

  // ========================================
  // OPTIMIZACIONES
  // ========================================
  PAGINATION: {
    code: 'FF-OPT-001',
    enabled: false,
    rollout: 0,
    description: 'Paginación de resultados',
    category: 'optimization'
  },

  IMAGE_COMPRESSION: {
    code: 'FF-OPT-002',
    enabled: false,
    rollout: 0,
    description: 'Compresión automática de fotos',
    category: 'optimization'
  },

  LAZY_LOADING: {
    code: 'FF-OPT-003',
    enabled: false,
    rollout: 0,
    description: 'Carga diferida de componentes pesados',
    category: 'optimization'
  },
};

/**
 * Verifica si una feature está habilitada para un usuario específico
 * @param {string} featureName - Nombre de la feature (ej: 'FRIENDS_SYSTEM')
 * @param {object} user - Objeto de usuario (opcional)
 * @returns {boolean}
 */
export function isFeatureEnabled(featureName, user = null) {
  const feature = FEATURE_FLAGS[featureName];

  if (!feature) {
    console.warn(`Feature flag "${featureName}" no existe`);
    return false;
  }

  // Si feature está globalmente deshabilitada, return false
  if (!feature.enabled) {
    return false;
  }

  // Si rollout es 100%, return true
  if (feature.rollout === 100) {
    return true;
  }

  // Si rollout es 0%, return false
  if (feature.rollout === 0) {
    return false;
  }

  // Si no hay usuario, no podemos calcular rollout
  if (!user) {
    return false;
  }

  // Calcular hash del UID del usuario para determinar si cae en el rollout
  // Esto garantiza que el mismo usuario siempre vea la misma feature
  const uid = user.uid || user.username || '';
  const hash = simpleHash(uid);
  const userPercentile = hash % 100;

  return userPercentile < feature.rollout;
}

/**
 * Hash simple de un string (para calcular rollout)
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Hook de React para verificar features
 */
export function useFeature(featureName, user = null) {
  return isFeatureEnabled(featureName, user);
}

/**
 * Obtener todas las features habilitadas para un usuario
 */
export function getEnabledFeatures(user = null) {
  return Object.keys(FEATURE_FLAGS).filter(
    featureName => isFeatureEnabled(featureName, user)
  );
}

/**
 * Obtener features por categoría
 */
export function getFeaturesByCategory(category) {
  return Object.entries(FEATURE_FLAGS)
    .filter(([, feature]) => feature.category === category)
    .reduce((acc, [name, feature]) => {
      acc[name] = feature;
      return acc;
    }, {});
}

/**
 * Obtener todas las categorías disponibles
 */
export function getCategories() {
  const categories = new Set();
  Object.values(FEATURE_FLAGS).forEach(feature => {
    categories.add(feature.category);
  });
  return Array.from(categories);
}

export default FEATURE_FLAGS;

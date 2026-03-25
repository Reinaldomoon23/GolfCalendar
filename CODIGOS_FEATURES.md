# Sistema de Códigos de Features - Golf Tracker

**Versión**: 1.0
**Fecha**: 17 de marzo de 2026

---

## 🏷️ Formato de Códigos

```
GT-[CATEGORIA]-[SUBCATEGORIA]-[NUMERO]

GT:            Golf Tracker (identificador del proyecto)
CATEGORIA:     Área funcional (2-3 letras)
SUBCATEGORIA:  Módulo específico (2-3 letras)
NUMERO:        Secuencial de 3 dígitos (001-999)
```

### Ejemplos
```
GT-SOC-FRI-001  →  Golf Tracker - Social - Friends - 001
GT-LIV-SHR-002  →  Golf Tracker - Live - Share - 002
GT-STT-CMP-001  →  Golf Tracker - Stats - Compare - 001
GT-SEC-FIR-003  →  Golf Tracker - Security - Firestore - 003
```

---

## 📂 Categorías Principales

### **SOC** - Social Features
Funcionalidades relacionadas con interacción entre usuarios

#### SOC-FRI: Sistema de Amigos
```
GT-SOC-FRI-001  Sistema base de amigos (lectura/escritura Firestore)
GT-SOC-FRI-002  Enviar solicitud de amistad
GT-SOC-FRI-003  Aceptar/Rechazar solicitud
GT-SOC-FRI-004  Eliminar amigo
GT-SOC-FRI-005  Buscar usuarios por username
GT-SOC-FRI-006  Buscar usuarios por email
GT-SOC-FRI-007  Generar QR de perfil
GT-SOC-FRI-008  Escanear QR para agregar amigo
GT-SOC-FRI-009  Notificaciones de solicitudes
GT-SOC-FRI-010  Contador de solicitudes pendientes
```

#### SOC-SHR: Compartir Contenido
```
GT-SOC-SHR-001  Compartir torneo con amigos
GT-SOC-SHR-002  Copiar torneo compartido
GT-SOC-SHR-003  Permisos de torneo compartido (copiar/editar)
GT-SOC-SHR-004  Revocar acceso a torneo compartido
GT-SOC-SHR-005  Link público de torneo
GT-SOC-SHR-006  Compartir scorecard como imagen
GT-SOC-SHR-007  Compartir perfil público
```

#### SOC-MSG: Mensajería (Futuro)
```
GT-SOC-MSG-001  Chat directo entre amigos
GT-SOC-MSG-002  Mensajes grupales
GT-SOC-MSG-003  Reacciones a resultados
```

---

### **LIV** - Live Mode
Funcionalidades de seguimiento en vivo

#### LIV-SHR: Compartir en Vivo
```
GT-LIV-SHR-001  URL compartida con nombre del jugador ✅ IMPLEMENTADO
GT-LIV-SHR-002  Suma de vueltas acumuladas ✅ IMPLEMENTADO
GT-LIV-SHR-003  Vista live multi-jugador (equipo)
GT-LIV-SHR-004  Actualización en tiempo real (WebSocket)
GT-LIV-SHR-005  Notificaciones push de actualizaciones
GT-LIV-SHR-006  Compartir hoyo específico
GT-LIV-SHR-007  Modo espectador (sin edición)
```

#### LIV-TRK: Tracking en Vivo
```
GT-LIV-TRK-001  GPS tracking de posición en campo
GT-LIV-TRK-002  Detección automática de hoyo
GT-LIV-TRK-003  Tiempo estimado de finalización
GT-LIV-TRK-004  Distancia restante al hoyo
```

#### LIV-WTH: Clima en Vivo
```
GT-LIV-WTH-001  Clima actual del campo ✅ IMPLEMENTADO
GT-LIV-WTH-002  Pronóstico por hoyo
GT-LIV-WTH-003  Alertas de mal clima
GT-LIV-WTH-004  Dirección y velocidad del viento
```

---

### **STT** - Statistics & Analysis
Estadísticas y análisis de rendimiento

#### STT-BAS: Estadísticas Básicas
```
GT-STT-BAS-001  Promedio de score
GT-STT-BAS-002  Mejor/Peor resultado
GT-STT-BAS-003  Torneos jugados
GT-STT-BAS-004  Gráfico de evolución
GT-STT-BAS-005  Stats por campo
```

#### STT-ADV: Estadísticas Avanzadas
```
GT-STT-ADV-001  Strokes Gained (total)
GT-STT-ADV-002  Strokes Gained (driving)
GT-STT-ADV-003  Strokes Gained (approach)
GT-STT-ADV-004  Strokes Gained (putting)
GT-STT-ADV-005  Scrambling percentage
GT-STT-ADV-006  Sand save percentage
GT-STT-ADV-007  Driving accuracy
GT-STT-ADV-008  GIR percentage
GT-STT-ADV-009  Putts por GIR
GT-STT-ADV-010  Putts totales promedio
```

#### STT-CMP: Comparación
```
GT-STT-CMP-001  Comparar con amigos (básico)
GT-STT-CMP-002  Comparar con amigos (avanzado)
GT-STT-CMP-003  Head-to-head en torneos comunes
GT-STT-CMP-004  Ranking entre amigos
GT-STT-CMP-005  Gráficos radar comparativos
GT-STT-CMP-006  Exportar comparación a imagen/PDF
```

#### STT-PRD: Predicciones
```
GT-STT-PRD-001  Predecir score esperado
GT-STT-PRD-002  Predecir hándicap futuro
GT-STT-PRD-003  Recomendaciones de mejora
```

---

### **RST** - Results Management
Gestión de resultados y scorecards

#### RST-SCR: Scorecard
```
GT-RST-SCR-001  Editor scorecard básico ✅ IMPLEMENTADO
GT-RST-SCR-002  Editor scorecard hoyo por hoyo ✅ IMPLEMENTADO
GT-RST-SCR-003  Autocompletado de pares
GT-RST-SCR-004  Importar scorecard de foto (OCR)
GT-RST-SCR-005  Validación de scores (máximo 10, mínimo par-2)
GT-RST-SCR-006  Edición rápida swipe
GT-RST-SCR-007  Copiar scorecard anterior
GT-RST-SCR-008  Template de scorecard favorito
```

#### RST-ENT: Entrada de Datos
```
GT-RST-ENT-001  Entrada manual de score
GT-RST-ENT-002  Entrada por voz
GT-RST-ENT-003  Sincronización con dispositivos GPS (Garmin, etc.)
GT-RST-ENT-004  Importar desde GHIN/WHS API
```

#### RST-HIS: Historial
```
GT-RST-HIS-001  Ver historial de resultados ✅ IMPLEMENTADO
GT-RST-HIS-002  Filtrar por temporada ✅ IMPLEMENTADO
GT-RST-HIS-003  Filtrar por campo
GT-RST-HIS-004  Filtrar por tipo de torneo
GT-RST-HIS-005  Exportar historial a CSV/PDF
```

---

### **TRN** - Tournaments
Gestión de torneos

#### TRN-OFC: Torneos Oficiales
```
GT-TRN-OFC-001  Cargar torneos RFEG ✅ IMPLEMENTADO
GT-TRN-OFC-002  Cargar torneos FCG ✅ IMPLEMENTADO
GT-TRN-OFC-003  Scraping automático de torneos
GT-TRN-OFC-004  Notificación de nuevos torneos
GT-TRN-OFC-005  Filtros de torneos ✅ IMPLEMENTADO
```

#### TRN-CST: Torneos Personalizados
```
GT-TRN-CST-001  Crear torneo personalizado ✅ IMPLEMENTADO
GT-TRN-CST-002  Editar torneo personalizado ✅ IMPLEMENTADO
GT-TRN-CST-003  Eliminar torneo personalizado ✅ IMPLEMENTADO
GT-TRN-CST-004  Duplicar torneo
GT-TRN-CST-005  Templates de torneos
GT-TRN-CST-006  Torneos recurrentes
```

#### TRN-REG: Registro
```
GT-TRN-REG-001  Inscripción a torneo
GT-TRN-REG-002  Cancelar inscripción
GT-TRN-REG-003  Lista de participantes
GT-TRN-REG-004  Confirmación automática
```

---

### **HCP** - Handicap System
Sistema de hándicap oficial

#### HCP-FTC: Fetch & Update
```
GT-HCP-FTC-001  Scraping hándicap RFEG ✅ IMPLEMENTADO
GT-HCP-FTC-002  Cache de hándicap ✅ IMPLEMENTADO
GT-HCP-FTC-003  Auto-actualización diaria ✅ IMPLEMENTADO
GT-HCP-FTC-004  Descargar PDF historial ✅ IMPLEMENTADO
GT-HCP-FTC-005  Sincronización con WHS API
GT-HCP-FTC-006  Notificación de cambio de hándicap
```

#### HCP-CLV: Cálculo Local
```
GT-HCP-CLV-001  Calcular hándicap local (sin federación)
GT-HCP-CLV-002  Ajuste de hándicap por campo (Course Rating)
GT-HCP-CLV-003  Hándicap de competición vs. hándicap de juego
```

#### HCP-HIS: Historial
```
GT-HCP-HIS-001  Gráfico de evolución de hándicap
GT-HCP-HIS-002  Historial de cambios
GT-HCP-HIS-003  Análisis de tendencia
```

---

### **USR** - User Management
Gestión de usuarios y perfiles

#### USR-PRF: Perfil
```
GT-USR-PRF-001  Editar perfil básico ✅ IMPLEMENTADO
GT-USR-PRF-002  Subir foto de perfil ✅ IMPLEMENTADO
GT-USR-PRF-003  Fotos en Cloudflare R2 ✅ IMPLEMENTADO
GT-USR-PRF-004  Editar bio/descripción
GT-USR-PRF-005  Links a redes sociales
GT-USR-PRF-006  Perfil público vs. privado
GT-USR-PRF-007  Verificación de perfil (badge)
```

#### USR-MGR: Manager Mode
```
GT-USR-MGR-001  Gestionar múltiples usuarios ✅ IMPLEMENTADO
GT-USR-MGR-002  Switch entre usuarios ✅ IMPLEMENTADO
GT-USR-MGR-003  Persistencia de usuario activo ✅ IMPLEMENTADO
GT-USR-MGR-004  Permisos de gestor
GT-USR-MGR-005  Transferir ownership
```

#### USR-PRV: Privacidad
```
GT-USR-PRV-001  Configuración de privacidad
GT-USR-PRV-002  Ocultar resultados
GT-USR-PRV-003  Ocultar hándicap
GT-USR-PRV-004  Bloquear usuarios
GT-USR-PRV-005  Reportar usuario
```

---

### **SEC** - Security & Performance
Seguridad y rendimiento

#### SEC-FIR: Firestore Security
```
GT-SEC-FIR-001  Reglas de acceso a usuarios
GT-SEC-FIR-002  Reglas de acceso a resultados
GT-SEC-FIR-003  Reglas de acceso a torneos
GT-SEC-FIR-004  Reglas de acceso a amigos
GT-SEC-FIR-005  Testing de reglas
GT-SEC-FIR-006  Audit de accesos
```

#### SEC-AUT: Authentication
```
GT-SEC-AUT-001  Login con email/password ✅ IMPLEMENTADO
GT-SEC-AUT-002  Login con Google
GT-SEC-AUT-003  Login con Apple
GT-SEC-AUT-004  Login con número de licencia (RFEG)
GT-SEC-AUT-005  2FA (autenticación de dos factores)
GT-SEC-AUT-006  Recuperación de contraseña
GT-SEC-AUT-007  Cambio de contraseña
```

#### SEC-PER: Performance
```
GT-SEC-PER-001  Índices Firestore
GT-SEC-PER-002  Paginación de resultados
GT-SEC-PER-003  Cache de estadísticas
GT-SEC-PER-004  Compresión de imágenes
GT-SEC-PER-005  Lazy loading de componentes
GT-SEC-PER-006  Service Worker optimizado
GT-SEC-PER-007  Prefetch de datos
```

---

### **INF** - Infrastructure
Infraestructura y DevOps

#### INF-ENV: Entornos
```
GT-INF-ENV-001  Entorno Development
GT-INF-ENV-002  Entorno Staging
GT-INF-ENV-003  Entorno Production
GT-INF-ENV-004  Variables de entorno
GT-INF-ENV-005  Migración de datos entre entornos
```

#### INF-FLG: Feature Flags
```
GT-INF-FLG-001  Sistema de feature flags
GT-INF-FLG-002  Panel de administración de flags
GT-INF-FLG-003  Feature flags remotos (Firebase Remote Config)
GT-INF-FLG-004  A/B testing con flags
GT-INF-FLG-005  Rollout gradual por porcentaje
```

#### INF-CID: CI/CD
```
GT-INF-CID-001  GitHub Actions para Stage
GT-INF-CID-002  GitHub Actions para Production
GT-INF-CID-003  Tests automáticos
GT-INF-CID-004  Linting automático
GT-INF-CID-005  Deploy automático
GT-INF-CID-006  Rollback automático
```

#### INF-MON: Monitoreo
```
GT-INF-MON-001  Firebase Analytics
GT-INF-MON-002  Sentry (error tracking)
GT-INF-MON-003  Performance monitoring
GT-INF-MON-004  Logs centralizados
GT-INF-MON-005  Alertas automáticas
GT-INF-MON-006  Dashboard de métricas
```

---

### **UI** - User Interface
Mejoras de interfaz

#### UI-THM: Temas
```
GT-UI-THM-001  Modo oscuro
GT-UI-THM-002  Temas personalizados
GT-UI-THM-003  Colores de organización personalizables ✅ IMPLEMENTADO
```

#### UI-NAV: Navegación
```
GT-UI-NAV-001  Navegación por tabs ✅ IMPLEMENTADO
GT-UI-NAV-002  Breadcrumbs
GT-UI-NAV-003  Menú hamburguesa
GT-UI-NAV-004  Quick actions (FAB)
```

#### UI-ACC: Accesibilidad
```
GT-UI-ACC-001  Soporte para lectores de pantalla
GT-UI-ACC-002  Alto contraste
GT-UI-ACC-003  Tamaño de fuente ajustable
GT-UI-ACC-004  Navegación por teclado
```

---

### **INT** - Integrations
Integraciones externas

#### INT-GPS: Dispositivos GPS
```
GT-INT-GPS-001  Integración Garmin
GT-INT-GPS-002  Integración Bushnell
GT-INT-GPS-003  Integración SkyCaddie
```

#### INT-FED: Federaciones
```
GT-INT-FED-001  API RFEG
GT-INT-FED-002  API FCG
GT-INT-FED-003  API USGA (WHS)
GT-INT-FED-004  API R&A
```

#### INT-SOC: Redes Sociales
```
GT-INT-SOC-001  Compartir en Instagram
GT-INT-SOC-002  Compartir en Twitter/X
GT-INT-SOC-003  Compartir en WhatsApp ✅ IMPLEMENTADO (navigator.share)
GT-INT-SOC-004  Compartir en Facebook
```

---

## 🔍 Uso de Códigos

### En Commits
```bash
git commit -m "feat(GT-SOC-FRI-001): Implementar sistema base de amigos

- Agregar schema Firestore users/{uid}/friends
- Crear API functions en friendsApi.js
- Componente FriendsView básico
- Feature flag deshabilitado por defecto
"
```

### En Pull Requests
```markdown
## GT-SOC-FRI-001: Sistema Base de Amigos

### Descripción
Implementa la estructura base del sistema de amigos.

### Cambios
- [x] Schema Firestore
- [x] API functions
- [x] Componente básico
- [ ] Tests unitarios

### Testing
- Probado en local
- Probado en stage
- Pendiente producción

### Feature Flag
- Código: GT-SOC-FRI-001
- Estado: Deshabilitado en producción
```

### En Issues
```markdown
Título: [GT-SOC-FRI-002] Implementar envío de solicitudes de amistad

Descripción:
Agregar funcionalidad para enviar solicitudes de amistad.

Dependencias:
- GT-SOC-FRI-001 (debe estar completo)

Estimación: 2 días
```

### En Código
```javascript
// src/config/featureFlags.js

export const FEATURES = {
  'GT-SOC-FRI-001': {
    code: 'GT-SOC-FRI-001',
    name: 'Sistema Base de Amigos',
    description: 'Estructura base para gestión de amigos',
    enabled: {
      development: true,
      staging: true,
      production: false
    },
    dependencies: [],
    version: '1.0.0',
    releaseDate: '2026-04-01'
  },

  'GT-SOC-FRI-002': {
    code: 'GT-SOC-FRI-002',
    name: 'Enviar Solicitud de Amistad',
    description: 'Permite enviar solicitudes a otros usuarios',
    enabled: {
      development: true,
      staging: false,
      production: false
    },
    dependencies: ['GT-SOC-FRI-001'],
    version: '1.0.0',
    releaseDate: '2026-04-05'
  }
};
```

---

## 📊 Dashboard de Features

### Por Estado

#### ✅ Implementados (En Producción)
```
GT-LIV-SHR-001  URL compartida con nombre
GT-LIV-SHR-002  Suma de vueltas acumuladas
GT-LIV-WTH-001  Clima actual del campo
GT-HCP-FTC-001  Scraping hándicap RFEG
GT-HCP-FTC-002  Cache de hándicap
GT-HCP-FTC-003  Auto-actualización diaria
GT-HCP-FTC-004  Descargar PDF historial
GT-USR-PRF-001  Editar perfil básico
GT-USR-PRF-002  Subir foto de perfil
GT-USR-PRF-003  Fotos en Cloudflare R2
GT-USR-MGR-001  Gestionar múltiples usuarios
GT-USR-MGR-002  Switch entre usuarios
GT-USR-MGR-003  Persistencia de usuario activo
GT-SEC-AUT-001  Login con email/password
GT-RST-SCR-001  Editor scorecard básico
GT-RST-SCR-002  Editor scorecard hoyo por hoyo
GT-TRN-OFC-001  Cargar torneos RFEG
GT-TRN-OFC-002  Cargar torneos FCG
GT-TRN-CST-001  Crear torneo personalizado
GT-UI-THM-003   Colores personalizables
GT-INT-SOC-003  Compartir en WhatsApp
```

#### 🚧 En Desarrollo
```
(Por definir según fase actual)
```

#### 📋 Planificados
```
GT-SOC-FRI-001 a GT-SOC-FRI-010  (Sistema de Amigos)
GT-SOC-SHR-001 a GT-SOC-SHR-007  (Compartir Contenido)
GT-STT-CMP-001 a GT-STT-CMP-006  (Comparación Stats)
... (ver secciones completas arriba)
```

---

## 🔄 Versionado de Códigos

Cuando una feature evoluciona significativamente, se puede:

### Opción 1: Nueva versión
```
GT-SOC-FRI-001-v1  →  Sistema base (original)
GT-SOC-FRI-001-v2  →  Sistema base mejorado (refactor)
```

### Opción 2: Nuevo código para evolución
```
GT-SOC-FRI-001  →  Sistema base
GT-SOC-FRI-011  →  Sistema base v2 (reescrito)
```

**Recomendación**: Opción 2 (nuevo código) para mantener trazabilidad.

---

## 📝 Plantilla para Nueva Feature

```markdown
## GT-[CAT]-[SUB]-[NUM]: [Nombre de la Feature]

### Descripción
[Descripción detallada de la funcionalidad]

### Categoría
- **Categoría**: [CATEGORIA]
- **Subcategoría**: [SUBCATEGORIA]
- **Código**: GT-[CAT]-[SUB]-[NUM]

### Dependencias
- [ ] GT-XXX-XXX-XXX (si aplica)

### Archivos Afectados
- [ ] `src/components/...`
- [ ] `src/utils/...`
- [ ] `firestore.rules`

### Feature Flag
- Estado Development: [true/false]
- Estado Staging: [true/false]
- Estado Production: [true/false]

### Testing
- [ ] Tests unitarios
- [ ] Tests integración
- [ ] Tests E2E
- [ ] Testing manual en stage

### Estimación
- Tiempo estimado: [X días/semanas]
- Prioridad: [Alta/Media/Baja]

### Criterios de Aceptación
1. [Criterio 1]
2. [Criterio 2]
3. [Criterio 3]

### Notas Adicionales
[Cualquier información relevante]
```

---

**Última actualización**: 17 de marzo de 2026
**Versión**: 1.0
**Mantenido por**: Reinaldo Moon

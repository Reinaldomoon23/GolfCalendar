# Configuración de Sentry - Error Tracking

**Fecha**: 24 de marzo de 2026
**Prioridad**: 🔴 ALTA
**Tiempo estimado**: 30 minutos

---

## 🎯 Objetivo

Implementar monitoreo de errores en producción para:
- Detectar bugs antes que los usuarios los reporten
- Ver stack traces completos de errores
- Monitorear performance de la app
- Trackear user sessions (opcional)

---

## 📝 Paso 1: Crear Cuenta Sentry

### 1.1 Registro
1. Ve a https://sentry.io/signup/
2. Crea cuenta gratuita (Developer plan)
   - ✅ Hasta 5,000 eventos/mes gratis
   - ✅ 30 días de retención de datos
   - ✅ Suficiente para empezar

### 1.2 Crear Proyecto
1. Click en "Create Project"
2. Selecciona plataforma: **React**
3. Nombre del proyecto: `golf-tracker-prod`
4. Click "Create Project"

### 1.3 Obtener DSN
Después de crear el proyecto, verás tu **DSN** (Data Source Name):

```
https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@o4504XXXXXXXX.ingest.sentry.io/4504XXXXXXXX
```

**IMPORTANTE**: Guarda este DSN, lo necesitarás en el siguiente paso.

---

## 📝 Paso 2: Configurar Variables de Entorno

### 2.1 Archivo `.env` (Development - NO trackear errores)
```bash
# .env (ya existe, solo agregar esta línea)
VITE_SENTRY_DSN=
```
Dejar vacío para NO trackear errores en desarrollo.

### 2.2 Archivo `.env.production` (Producción)
Crear archivo nuevo:

```bash
# .env.production
VITE_SENTRY_DSN=https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@o4504XXXXXXXX.ingest.sentry.io/4504XXXXXXXX
```
**Reemplaza con tu DSN real de Sentry.**

### 2.3 Archivo `.env.staging` (Staging - Opcional)
Si quieres trackear errores en staging también:

```bash
# .env.staging (ya existe, solo agregar)
VITE_SENTRY_DSN=https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@o4504XXXXXXXX.ingest.sentry.io/4504XXXXXXXX
```
Puedes usar el mismo DSN o crear un proyecto separado "golf-tracker-stage".

---

## 📝 Paso 3: Actualizar `.gitignore`

Asegúrate que `.env.production` NO se suba a Git:

```bash
# .gitignore (verificar que existe)
.env
.env.local
.env.production
.env.staging
```

---

## 📝 Paso 4: Testing Local

### 4.1 Probar en Development
```bash
npm run dev
```

Deberías ver en consola:
```
Sentry: Disabled in development
```
✅ Correcto - No trackea en desarrollo.

### 4.2 Probar en Production (local)
```bash
# Build para producción
npm run build

# Servir build localmente
npm run preview
```

Deberías ver en consola:
```
Sentry: Initialized successfully
```
✅ Correcto - Trackea en producción.

### 4.3 Forzar un Error de Prueba
Abre la consola del navegador y ejecuta:

```javascript
throw new Error('Test error from Sentry setup');
```

Luego ve a https://sentry.io → Projects → golf-tracker-prod → Issues

Deberías ver el error capturado. 🎉

---

## 📝 Paso 5: Integrar con Firebase Auth

Para trackear qué usuario tuvo el error, necesitamos integrar con Firebase Auth.

### 5.1 Buscar archivo `App.jsx`
Encuentra donde se carga el usuario autenticado (probablemente con `onAuthStateChanged`).

### 5.2 Agregar Sentry User Context
```javascript
import { setUser } from './utils/sentry';

// Dentro de onAuthStateChanged o donde se obtiene el user
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Informar a Sentry quién es el usuario actual
        setUser({
            uid: user.uid,
            username: user.displayName || user.email?.split('@')[0],
        });
    } else {
        setUser(null);
    }

    // ... resto del código
});
```

---

## 📊 Uso de Sentry en el Código

### Capturar Excepciones Manualmente
```javascript
import { captureException } from '../utils/sentry';

try {
    await saveToFirestore(data);
} catch (error) {
    console.error('Error saving data:', error);
    captureException(error, {
        context: 'saveToFirestore',
        userId: user.uid,
        data: data
    });
    alert('Error al guardar. Intenta de nuevo.');
}
```

### Capturar Mensajes Personalizados
```javascript
import { captureMessage } from '../utils/sentry';

// Warning
captureMessage('User tried to delete last round', 'warning');

// Info
captureMessage('Migration from PHP to Firebase completed', 'info');
```

### Breadcrumbs (Rastrear acciones del usuario)
```javascript
import { addBreadcrumb } from '../utils/sentry';

// Navigation
addBreadcrumb('User opened CalendarView', 'navigation', { tournamentId: 123 });

// API Call
addBreadcrumb('Fetching handicap from RFEG', 'api', { userId: user.uid });

// User Action
addBreadcrumb('User clicked Share Live Scorecard', 'user-action');
```

### Performance Tracking
```javascript
import { trackPerformance } from '../utils/sentry';

const results = await trackPerformance('loadTournaments', async () => {
    const snapshot = await getDocs(collection(db, 'tournaments'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
});
```

---

## 🎛️ Configuración Avanzada (Opcional)

### Alertas por Email
1. Ve a Sentry → Settings → Alerts
2. Crea alerta: "Send email when new issue is created"
3. Configurar destinatarios

### Integración con Slack (si usas Slack)
1. Sentry → Settings → Integrations → Slack
2. Connect Slack Workspace
3. Configurar canal #golf-tracker-errors

### Release Tracking (para saber qué versión causó el error)
En `vite.config.js`:
```javascript
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default {
    plugins: [
        sentryVitePlugin({
            org: "tu-org",
            project: "golf-tracker-prod",
            authToken: process.env.SENTRY_AUTH_TOKEN,
        }),
    ],
    build: {
        sourcemap: true, // Importante para stack traces
    },
};
```

---

## ✅ Checklist de Implementación

### Configuración
- [ ] Crear cuenta en Sentry.io
- [ ] Crear proyecto "golf-tracker-prod"
- [ ] Copiar DSN
- [ ] Agregar `VITE_SENTRY_DSN` a `.env.production`
- [ ] Verificar que `.env.production` está en `.gitignore`

### Código
- [x] Instalar `@sentry/react` ✅
- [x] Crear `src/utils/sentry.js` ✅
- [x] Integrar en `src/main.jsx` ✅
- [ ] Integrar con Firebase Auth (setUser)
- [ ] Agregar captureException en try/catch críticos

### Testing
- [ ] Build local (`npm run build`)
- [ ] Preview local (`npm run preview`)
- [ ] Forzar error de prueba
- [ ] Verificar error en Sentry.io dashboard

### Deploy
- [ ] Deploy a producción (Hostinger/Vercel)
- [ ] Verificar que Sentry funciona en producción
- [ ] Configurar alertas por email

---

## 🚨 Troubleshooting

### "Sentry: DSN not configured"
✅ Solución: Agregar `VITE_SENTRY_DSN` a `.env.production`

### No veo errores en Sentry
1. Verificar que `MODE === 'production'` en build
2. Verificar que DSN es correcto
3. Verificar consola del navegador (debe decir "Sentry: Initialized successfully")
4. Forzar un error manualmente: `throw new Error('Test')`

### Demasiados errores capturados
Ajustar `ignoreErrors` en `src/utils/sentry.js`:
```javascript
ignoreErrors: [
    'NetworkError',
    'Failed to fetch',
    'ResizeObserver loop limit exceeded',
    // Agregar más aquí
],
```

### Privacy concerns (PII)
El código ya incluye filtros para:
- ✅ Emails reemplazados por `[EMAIL_REDACTED]`
- ✅ UIDs reemplazados por `[REDACTED]`
- ✅ No se envía email en user context

---

## 📊 Métricas Esperadas

### Errores Comunes a Trackear
1. **Firestore Permission Denied** → Indica problema con reglas
2. **Network Errors** → Problemas de conectividad
3. **Undefined variables** → Bugs en código
4. **Failed API calls** → Problemas con APIs externas (RFEG, etc.)

### Performance Metrics
- Tiempo de carga inicial
- Tiempo de fetch de torneos
- Tiempo de guardado de resultados

---

## 🎯 Próximos Pasos

Después de implementar Sentry:
1. ✅ Firestore Rules ✅
2. ✅ Sentry (Error Tracking) ✅
3. ⏳ Entorno Staging (siguiente)
4. ⏳ Tests Automatizados

---

**Última actualización**: 24 de marzo de 2026
**Autor**: Reinaldo Moon + Claude
**Documentos relacionados**:
- [DEPLOYMENT_LOG.md](DEPLOYMENT_LOG.md)
- [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md)

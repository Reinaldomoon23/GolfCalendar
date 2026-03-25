# 🚀 Configuración Vercel + GitHub para Golf Tracker

**Fecha**: 17 de marzo de 2026
**Objetivo**: Deploy automático con Staging y Production separados
**Repositorio**: https://github.com/Reinaldomoon23/GolfCalendar.git

---

## 📋 Resumen

Vamos a configurar **dos proyectos en Vercel**:

1. **Production** (`golf-tracker-prod`) → rama `main`
2. **Staging** (`golf-tracker-staging`) → rama `staging`

Ambos usan la **misma base de datos Firebase** (`golfscorings-e4338`), pero con URLs diferentes.

---

## 🔧 Paso 1: Crear Rama Staging en GitHub

```bash
# Crear rama staging desde main
git checkout -b staging
git push -u origin staging

# Volver a main
git checkout main
```

---

## 🌐 Paso 2: Configurar Proyecto de Production en Vercel

### 2.1 Conectar Repositorio

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Click en **"Add New Project"**
3. Selecciona el repositorio: `Reinaldomoon23/GolfCalendar`
4. **Nombre del proyecto**: `golf-tracker-production`
5. **Framework Preset**: Vite
6. **Root Directory**: `./`
7. **Build Command**: `npm run build`
8. **Output Directory**: `dist`

### 2.2 Variables de Entorno (Production)

En la configuración del proyecto, añade estas variables:

```bash
VITE_ENVIRONMENT=production
VITE_APP_MODE=multi
VITE_BASE_URL=/
VITE_FIREBASE_API_KEY=AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0
VITE_FIREBASE_AUTH_DOMAIN=golfscorings-e4338.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=golfscorings-e4338
VITE_FIREBASE_STORAGE_BUCKET=golfscorings-e4338.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=987034024177
VITE_FIREBASE_APP_ID=1:987034024177:web:560e69822800f3a613d150
```

### 2.3 Configurar Branch

- **Production Branch**: `main`
- **Auto-deploy**: ✅ Enabled

---

## 🧪 Paso 3: Configurar Proyecto de Staging en Vercel

### 3.1 Crear Segundo Proyecto

1. Click en **"Add New Project"** de nuevo
2. Selecciona el **mismo repositorio**: `Reinaldomoon23/GolfCalendar`
3. **Nombre del proyecto**: `golf-tracker-staging`
4. **Framework Preset**: Vite
5. **Root Directory**: `./`
6. **Build Command**: `npm run build`
7. **Output Directory**: `dist`

### 3.2 Variables de Entorno (Staging)

```bash
VITE_ENVIRONMENT=staging
VITE_APP_MODE=multi
VITE_BASE_URL=/
VITE_FIREBASE_API_KEY=AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0
VITE_FIREBASE_AUTH_DOMAIN=golfscorings-e4338.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=golfscorings-e4338
VITE_FIREBASE_STORAGE_BUCKET=golfscorings-e4338.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=987034024177
VITE_FIREBASE_APP_ID=1:987034024177:web:560e69822800f3a613d150
```

### 3.3 Configurar Branch

- **Production Branch**: `staging` ⚠️ ¡Importante! Aquí seleccionas la rama `staging`, no `main`
- **Auto-deploy**: ✅ Enabled

---

## 📦 Paso 4: Configurar package.json

Ya tienes el script, pero asegúrate de que existe:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:staging": "vite build --mode staging",
    "preview": "vite preview"
  }
}
```

---

## 🔄 Paso 5: Workflow de Desarrollo

### Para cambios en STAGING:

```bash
# 1. Cambiar a rama staging
git checkout staging

# 2. Hacer cambios en el código
# ... editar archivos ...

# 3. Commit y push
git add .
git commit -m "feat: nueva funcionalidad en staging"
git push origin staging

# 4. Vercel auto-deploys a: https://golf-tracker-staging.vercel.app
```

### Para cambios en PRODUCTION:

```bash
# 1. Asegurarse de que staging funciona correctamente

# 2. Merge staging → main
git checkout main
git merge staging
git push origin main

# 3. Vercel auto-deploys a: https://golf-tracker-production.vercel.app
```

---

## 🎯 Paso 6: Dominios Personalizados (Opcional)

Si quieres usar dominios personalizados:

### Production
- Dominio: `golftracker.reinaldomoon.top`
- CNAME apuntando a: `cname.vercel-dns.com`

### Staging
- Dominio: `staging.golftracker.reinaldomoon.top`
- CNAME apuntando a: `cname.vercel-dns.com`

---

## ✅ Paso 7: Verificación

### Verifica Production
1. Ve a: https://golf-tracker-production.vercel.app
2. Login con: `nicole@golfteam.app`
3. Verifica que todo funciona

### Verifica Staging
1. Ve a: https://golf-tracker-staging.vercel.app
2. Login con: `nicole@golfteam.app`
3. Verifica que todo funciona
4. Usa este entorno para testing

---

## 📊 Ventajas de esta Configuración

✅ **Deploy automático**: Push a `staging` → deploy a staging, push a `main` → deploy a production
✅ **Preview URLs**: Cada PR genera una preview URL automática
✅ **Rollback fácil**: Un click para volver a versión anterior
✅ **Analytics**: Métricas de rendimiento integradas
✅ **Sin FTP**: No expones credenciales
✅ **CI/CD**: GitHub Actions puede correr tests antes de merge

---

## 🔒 Seguridad

- Las variables de entorno están encriptadas en Vercel
- No commitees archivos `.env` al repositorio
- Firebase credentials son públicas (API Key) pero protegidas por reglas de seguridad
- Implementaremos reglas restrictivas en FASE 1

---

## 📝 Checklist de Setup

- [ ] Crear rama `staging` en GitHub
- [ ] Crear proyecto Vercel Production (rama `main`)
- [ ] Configurar variables de entorno Production
- [ ] Crear proyecto Vercel Staging (rama `staging`)
- [ ] Configurar variables de entorno Staging
- [ ] Hacer primer deploy a staging
- [ ] Verificar staging funciona correctamente
- [ ] Hacer primer deploy a production
- [ ] Verificar production funciona correctamente
- [ ] (Opcional) Configurar dominios personalizados

---

## 🚀 Próximos Pasos

Una vez configurado Vercel + GitHub:

1. **Testing Funcional** → Usar staging para ejecutar TEST_MANUAL_FUNCIONAL.md
2. **Feature Flags** → Implementar sistema GT-XXX-XXX-XXX en staging
3. **Seguridad** → Implementar reglas restrictivas Firestore
4. **Monitoreo** → Configurar Sentry y Firebase Analytics

---

## 🆘 Troubleshooting

### Build falla en Vercel

**Error**: `command not found: vite`
**Solución**: Verifica que `vite` está en `dependencies` o `devDependencies` en package.json

**Error**: `Cannot find module 'firebase'`
**Solución**: Corre `npm install` localmente y asegúrate que package-lock.json está commiteado

### Variables de entorno no funcionan

**Error**: `Firebase: Error (auth/invalid-api-key)`
**Solución**: Verifica que todas las variables `VITE_FIREBASE_*` están configuradas en Vercel

### PWA no funciona

**Error**: Service worker no se registra
**Solución**: Verifica que `dist/service-worker.js` se generó en el build

---

**Última actualización**: 17 de marzo de 2026

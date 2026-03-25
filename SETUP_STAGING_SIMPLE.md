# Setup Staging Simple - Misma Base de Datos, URL Diferente

**Objetivo**: Desplegar la app en URL de staging usando la MISMA configuración de producción
**Ventaja**: No necesitas duplicar datos ni crear usuarios de prueba
**Tiempo estimado**: 30-45 minutos

---

## 🎯 Concepto

```
┌──────────────────────────────────────────┐
│     MISMO FIREBASE (golf-tracker-prod)   │
│     - Mismos usuarios                    │
│     - Misma base de datos                │
│     - Mismos datos                       │
└──────────────┬──────────────┬────────────┘
               │              │
               ▼              ▼
    ┌──────────────┐  ┌──────────────┐
    │  STAGING     │  │  PRODUCCIÓN  │
    │  nueva URL   │  │  URL actual  │
    └──────────────┘  └──────────────┘

✅ Staging = Mismo código + Misma DB + URL diferente
✅ Testing seguro porque usuarios normales usan URL de producción
✅ Tú testeas en URL de staging sin molestar a nadie
```

---

## 📋 Pasos (30-45 min)

### PASO 1: Crear Archivo de Configuración Vercel

**Crear**: `vercel.json` en la raíz del proyecto

```json
{
  "version": 2,
  "name": "golf-tracker-staging",
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "VITE_ENVIRONMENT": "staging",
    "VITE_APP_MODE": "multi"
  }
}
```

---

### PASO 2: Crear Archivo .env.staging

**Crear**: `.env.staging` (con las MISMAS credenciales de producción)

```bash
# Copiar EXACTAMENTE las variables de .env.production
# O si no tienes .env.production, usar las que están en tu código actual

VITE_ENVIRONMENT=staging
VITE_APP_MODE=multi
VITE_BASE_URL=/

# Firebase (MISMAS credenciales que producción)
VITE_FIREBASE_API_KEY=[la misma que producción]
VITE_FIREBASE_AUTH_DOMAIN=[la misma que producción]
VITE_FIREBASE_PROJECT_ID=[la misma que producción]
VITE_FIREBASE_STORAGE_BUCKET=[la misma que producción]
VITE_FIREBASE_MESSAGING_SENDER_ID=[la misma que producción]
VITE_FIREBASE_APP_ID=[la misma que producción]

# Feature Flags (puedes habilitar todas en staging)
VITE_ENABLE_ALL_FEATURES=true
```

**Nota**: Si no tienes archivo `.env.production`, mira las credenciales en `src/firebase.js`

---

### PASO 3: Actualizar package.json

Agregar script de build para staging:

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

### PASO 4: Deploy a Vercel (2 opciones)

#### Opción A: Via Dashboard Vercel (Más Fácil - Recomendado)

1. **Ir a Vercel**
   - URL: https://vercel.com/
   - Login con tu cuenta

2. **Importar Proyecto**
   - Clic en "Add New..." → "Project"
   - Conectar tu repositorio GitHub
   - Seleccionar el repo de Golf Tracker

3. **Configurar Proyecto**
   ```
   Project Name: golf-tracker-staging
   Framework Preset: Vite
   Root Directory: ./
   Build Command: npm run build:staging
   Output Directory: dist
   Install Command: npm install
   ```

4. **Agregar Variables de Entorno**
   - En la misma pantalla, scroll down a "Environment Variables"
   - Agregar TODAS las variables de `.env.staging`:
     - `VITE_ENVIRONMENT` = `staging`
     - `VITE_APP_MODE` = `multi`
     - `VITE_BASE_URL` = `/`
     - `VITE_FIREBASE_API_KEY` = `[tu API key]`
     - `VITE_FIREBASE_AUTH_DOMAIN` = `[tu auth domain]`
     - `VITE_FIREBASE_PROJECT_ID` = `[tu project id]`
     - `VITE_FIREBASE_STORAGE_BUCKET` = `[tu storage bucket]`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID` = `[tu sender id]`
     - `VITE_FIREBASE_APP_ID` = `[tu app id]`
     - `VITE_ENABLE_ALL_FEATURES` = `true`

5. **Deploy**
   - Clic en "Deploy"
   - Esperar 2-3 minutos
   - ✅ Obtendrás una URL tipo: `https://golf-tracker-staging.vercel.app`

---

#### Opción B: Via CLI Vercel

```bash
# 1. Instalar Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy (desde la raíz del proyecto)
vercel

# Responder:
# - Set up and deploy? Yes
# - Which scope? [tu cuenta]
# - Link to existing project? No
# - Project name? golf-tracker-staging
# - Directory? ./
# - Override settings? Yes
#   - Build Command: npm run build:staging
#   - Output Directory: dist

# 4. Agregar variables de entorno
vercel env add VITE_ENVIRONMENT
# Ingresar: staging

vercel env add VITE_FIREBASE_API_KEY
# Ingresar: [tu API key]

# ... repetir para todas las variables

# 5. Deploy final
vercel --prod
```

---

### PASO 5: Obtener Credenciales Firebase Actuales

Si no tienes las credenciales a mano, las puedes obtener de:

**Opción 1: Desde el código actual**

Abrir `src/firebase.js` y buscar el objeto `firebaseConfig`:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "golf-tracker-xxxx.firebaseapp.com",
  projectId: "golf-tracker-xxxx",
  // etc.
};
```

**Opción 2: Desde Firebase Console**

1. Ir a https://console.firebase.google.com/
2. Seleccionar tu proyecto actual
3. Ir a "Configuración del proyecto" (⚙️)
4. Scroll down a "Tus apps"
5. Copiar las credenciales

---

### PASO 6: Validación

Una vez deployado:

1. **Abrir URL de Staging**
   ```
   https://golf-tracker-staging.vercel.app
   ```

2. **Hacer Login**
   - Usar tus credenciales REALES (nicole@golfteam.app, etc.)
   - Mismo login que en producción

3. **Verificar**
   - ✅ Ves tus datos reales
   - ✅ Mismos usuarios
   - ✅ Mismos resultados
   - ✅ Mismos torneos

4. **Confirmar Separación**
   - Staging: `https://golf-tracker-staging.vercel.app`
   - Producción: `https://reinaldomoon.top/GolfTeam/`
   - Son URLs diferentes pero misma base de datos

---

## 🎯 Ahora Puedes Testear Sin Miedo

### Para Testing:
```
URL: https://golf-tracker-staging.vercel.app
Usuarios: Los mismos de producción (nicole@golfteam.app, etc.)
```

### Para Usuarios Reales:
```
URL: https://reinaldomoon.top/GolfTeam/
(Siguen usando esta URL sin interrupciones)
```

### Ventajas:
- ✅ No duplicas datos
- ✅ No creas usuarios de prueba
- ✅ Testing con datos reales
- ✅ Usuarios no se enteran que estás testeando
- ✅ Si rompes algo en staging, NO afecta a producción (URL diferente)

---

## 📱 Uso Práctico

### Escenario 1: Testing de Nueva Feature
```bash
# 1. Desarrollas localmente
npm run dev

# 2. Commit y push
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main

# 3. Vercel auto-deploya a staging
# (si configuraste auto-deploy)

# 4. Testeas en: https://golf-tracker-staging.vercel.app

# 5. Si todo OK, actualizas producción
# (puedes tener CI/CD separado para producción)
```

### Escenario 2: Hotfix Urgente
```bash
# 1. Haces cambio
# 2. Deploy directo a staging para verificar
vercel --prod

# 3. Testeas rápido
# 4. Si OK, deploy a producción
```

---

## ⚙️ Configuración Auto-Deploy (Opcional)

Si quieres que Vercel auto-depliegue en cada push a `main`:

1. En Vercel Dashboard → tu proyecto
2. Settings → Git
3. Habilitar "Auto Deploy"
4. Branch: `main`

Así cada vez que hagas push, staging se actualiza automáticamente.

---

## 🔄 Actualizar Staging

```bash
# Opción 1: Auto (si configuraste auto-deploy)
git push origin main
# Vercel detecta y deploya automáticamente

# Opción 2: Manual
vercel --prod

# Opción 3: Via Dashboard
# Ir a Vercel → proyecto → Deployments → Redeploy
```

---

## 📊 Resumen de URLs

```
🟢 STAGING (para ti, testing):
   https://golf-tracker-staging.vercel.app

🔴 PRODUCCIÓN (para usuarios reales):
   https://reinaldomoon.top/GolfTeam/

🔥 FIREBASE (compartido por ambos):
   Proyecto: golf-tracker-prod (el actual)
   Usuarios: Los mismos
   Base de datos: La misma
```

---

## ❓ FAQ

**P: ¿Si creo un resultado en staging, lo verán en producción?**
R: SÍ, porque usan la misma base de datos. Por eso staging es para TESTEAR antes de tocar producción.

**P: ¿Si borro algo en staging, se borra en producción?**
R: SÍ, misma base de datos. Ten cuidado con operaciones destructivas.

**P: ¿Entonces cuál es la ventaja?**
R: La ventaja es que los usuarios normales siguen usando la URL de producción. Tú testeas en staging sin interrumpirlos. Si hay un bug en staging, solo lo ves tú.

**P: ¿Y si quiero datos completamente separados?**
R: Entonces necesitas el setup completo con proyecto Firebase separado (ver SETUP_STAGING.md).

---

## 🎯 Próximos Pasos

Una vez staging esté deployado:

1. ✅ Abrir [TEST_MANUAL_FUNCIONAL.md](TEST_MANUAL_FUNCIONAL.md)
2. ✅ Ejecutar tests en `https://golf-tracker-staging.vercel.app`
3. ✅ Reportar bugs encontrados
4. ✅ Arreglar en código
5. ✅ Push → Auto-deploy a staging
6. ✅ Re-testear
7. ✅ Cuando todo OK → Deploy a producción

---

**Última actualización**: 17 de marzo de 2026
**Tiempo estimado**: 30-45 minutos
**Dificultad**: ⭐⭐ Fácil

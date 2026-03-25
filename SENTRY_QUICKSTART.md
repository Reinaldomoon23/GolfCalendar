# Sentry Quickstart - Configuración Rápida

**Tiempo total**: 5 minutos ⏱️

---

## ✅ Ya Está Hecho

- ✅ Código de Sentry implementado
- ✅ `.env.production` creado
- ✅ `.gitignore` actualizado
- ✅ Scripts de build configurados

**Solo te falta**: Obtener tu DSN de Sentry (3 minutos)

---

## 📝 Pasos a Seguir (HAZ ESTO AHORA)

### Paso 1: Crear Cuenta (2 min)

1. Abre: https://sentry.io/signup/

2. Regístrate con:
   - **GitHub** ← Recomendado (más rápido)
   - Google
   - Email

3. Si usas GitHub/Google → Automático ✅

---

### Paso 2: Crear Proyecto (1 min)

Después de registrarte verás un wizard:

**Pregunta 1**: Select a platform
```
→ Selecciona: React
```

**Pregunta 2**: Alert frequency
```
→ Deja default: "Alert me on every new issue"
```

**Pregunta 3**: Name your project
```
→ Escribe: golf-tracker-prod
```

**Click**: "Create Project"

---

### Paso 3: Copiar DSN (30 seg)

Verás una pantalla de código con instrucciones. **Ignora el código**, solo necesitas esto:

Busca esta línea (aparece en la parte superior):

```javascript
Sentry.init({
  dsn: "https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@oXXXXXXX.ingest.sentry.io/XXXXXXX",
  //...
});
```

**COPIA TODO el DSN** (desde `https://` hasta el número final)

Ejemplo:
```
https://1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p@o4507123456789.ingest.sentry.io/4507123456789
```

---

### Paso 4: Pegar DSN en .env.production (30 seg)

1. Abre el archivo: `.env.production`

2. Encuentra esta línea:
```bash
VITE_SENTRY_DSN=
```

3. Pega tu DSN:
```bash
VITE_SENTRY_DSN=https://1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p@o4507123456789.ingest.sentry.io/4507123456789
```

4. Guarda el archivo ✅

---

### Paso 5: Probar Sentry (1 min)

Ahora vamos a probarlo localmente:

#### 5.1 Build para producción
```bash
npm run build
```

Deberías ver:
```
✓ built in 10s
dist/index.html                   0.46 kB
dist/assets/index-abc123.js     500.00 kB
```

#### 5.2 Servir build localmente
```bash
npm run preview
```

Verás:
```
  ➜  Local:   http://localhost:4173/
```

#### 5.3 Abrir en navegador

1. Abre: http://localhost:4173/
2. Abre la **Consola del navegador** (F12)
3. Deberías ver:
```
Sentry: Initialized successfully
```

✅ ¡Perfecto!

---

### Paso 6: Forzar Error de Prueba (30 seg)

En la **consola del navegador**, escribe esto y presiona Enter:

```javascript
throw new Error('🧪 Test error from Sentry setup - This is a test!');
```

Verás un error en rojo (normal).

---

### Paso 7: Verificar en Sentry Dashboard (1 min)

1. Ve a: https://sentry.io/issues/

2. Deberías ver tu error capturado:
```
┌────────────────────────────────────────────┐
│ 🔴 New Issue                               │
│                                            │
│ Error: 🧪 Test error from Sentry setup    │
│ main.jsx:8                                 │
│                                            │
│ 1 user | 1 event | Just now               │
└────────────────────────────────────────────┘
```

3. Click en el error para ver detalles:
   - Stack trace completo
   - Navegador usado
   - URL donde ocurrió
   - Timestamp

✅ **¡Funcionó!** 🎉

---

## 🎯 Siguiente Paso: Integrar con Firebase Auth

Para saber QUÉ usuario tuvo el error, necesitamos integrar con Firebase Auth.

Voy a hacerlo por ti. Espera un momento...

---

## ❓ Troubleshooting

### No veo "Sentry: Initialized successfully"
→ Verifica que `.env.production` tiene el DSN correcto
→ Verifica que hiciste `npm run build` (no `npm run dev`)

### Veo "Sentry: DSN not configured"
→ El DSN está vacío o mal copiado en `.env.production`

### No veo el error en Sentry.io
→ Espera 30 segundos y recarga la página
→ Verifica que estás en el proyecto correcto (golf-tracker-prod)

### Veo "Sentry: Disabled in development"
→ Estás en modo dev (`npm run dev`), usa `npm run build` + `npm run preview`

---

## 📊 Qué Hacer Después

1. ✅ Completar estos 7 pasos (5 min total)
2. ⏳ Avísame cuando veas el error en Sentry
3. ⏳ Integro Sentry con Firebase Auth (yo lo hago)
4. ⏳ Deploy a producción
5. ✅ ¡Monitoreo activo!

---

**¿Tienes problemas?** Dime en qué paso estás atascado y te ayudo.

---

**Última actualización**: 24 de marzo de 2026
**Autor**: Claude para Reinaldo Moon

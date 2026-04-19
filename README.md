# Golf Tracker - PWA de Gestión de Golf

**Versión**: 2.5.7
**Estado**: En producción
**Hosting Principal (Vercel)**: Vercel (Auto-deployed vía GitHub Push)

---

## 🚀 Inicio Rápido y Despliegue (IMPORTANTE PARA IAs)

1. **Despliegue a Producción (Vercel)**:  
   La arquitectura de despliegue actual depende EN SU TOTALIDAD de Vercel. 
   Para publicar código en vivo basta con hacer:
   ```bash
   git add .
   git commit -m "Descripción"
   git push origin HEAD
   ```
   🚨 **PROHIBIDO EL USO DE FTP O SCRIPTS (`deploy.sh`, `deploy.cjs`)**. La infraestructura antigua de `reinaldomoon.top/GolfTeam/` ha sido relevada por Vercel. Para detalles completos de infraestructura lee `DEPLOYMENT_PIPELINE.md`.

2. **Entorno de desarrollo local**:
   ```bash
   npm install
   npm run dev
   ```

---

## 📖 Documentación Técnica Completa

**⚠️ IMPORTANTE: Para desarrolladores y modelos de IA**

Toda la documentación técnica detallada del proyecto se encuentra en:

**[DOCUMENTACION_TECNICA.md](./DOCUMENTACION_TECNICA.md)**

Este archivo contiene:
- ✅ Arquitectura completa del sistema
- ✅ Stack tecnológico y versiones
- ✅ Estructura de datos (Firestore schema)
- ✅ Flujos de autenticación, hándicap, resultados
- ✅ Guías de desarrollo y debugging
- ✅ TODOs y roadmap detallado
- ✅ Ejemplos de código completos
- ✅ Configuración de Firebase, R2, APIs PHP

**Si eres un modelo de IA trabajando en este proyecto**, lee primero `DOCUMENTACION_TECNICA.md` para entender completamente el contexto, arquitectura y estado actual.

---

## 🎯 ¿Qué es Golf Tracker?

Progressive Web App para gestionar:
- 📅 Calendarios de torneos de golf (RFEG, FCG, clubs)
- 📊 Resultados y scorecards hoyo por hoyo
- 📈 Hándicap oficial automático
- 📉 Estadísticas y análisis
- 👥 Múltiples perfiles (modo manager)

---

## 🏗️ Stack Tecnológico

- **Frontend**: React 19 + Vite 7
- **Backend**: Firebase (Auth + Firestore)
- **Storage**: Cloudflare R2
- **PWA**: vite-plugin-pwa + Workbox
- **Gráficos**: Chart.js
- **APIs Legacy**: PHP (en proceso de eliminación)

---

## 📁 Estructura del Proyecto

```
├── DOCUMENTACION_TECNICA.md    ← 📖 LEE ESTO PRIMERO
├── PASOS_MIGRACION_FIREBASE.md ← Roadmap de migración
├── src/
│   ├── App.jsx                 ← Componente raíz
│   ├── firebase.js             ← Config Firebase
│   ├── components/             ← Componentes React
│   └── utils/                  ← Helpers
├── public/api/                 ← APIs PHP legacy
├── scripts/                    ← Scripts de migración
└── package.json
```

---

## 🔥 Comandos Útiles

```bash
# Desarrollo
npm run dev                    # Dev server (puerto 5173)
npm run build                  # Build producción
npm run preview                # Preview build

# Scripts Firebase
node scripts/migrate_users_to_firebase.js
node scripts/list_users.js

# Debugging
npm run lint                   # ESLint
```

---

## 🌐 Variables de Entorno

Crear `.env.local`:

```bash
VITE_APP_MODE=multi           # 'single' o 'multi'
VITE_BASE_URL=/               # Base path
VITE_USE_EMULATORS=false      # Usar emuladores Firebase
```

---

## 📋 Estado Actual

### ✅ Completado
- Migración completa a Firebase Authentication
- Sistema de hándicap con cache inteligente
- Manager mode (multi-usuario)
- PWA funcional con offline-first
- Fotos en Cloudflare R2
- Sincronización en tiempo real (Firestore)
- **Mejoras modo Live**: Suma de vueltas + nombre en compartir

### 🚧 En Progreso
- **Plan de Escalabilidad**: Preparación para miles de usuarios
  - Testing funcional exhaustivo
  - Reglas de seguridad Firestore
  - Optimizaciones de rendimiento
  - Ver [PLAN_ESCALABILIDAD.md](./PLAN_ESCALABILIDAD.md)

### 🔜 Próximamente
- **Sistema Stage/Production**: Entornos separados + Feature Flags
  - Ver [SISTEMA_STAGE_PRODUCTION.md](./SISTEMA_STAGE_PRODUCTION.md)
- **Nuevas Funcionalidades**: Sistema de amigos, compartir torneos, comparar stats
  - Ver [ROADMAP_FEATURES.md](./ROADMAP_FEATURES.md)

---

## 👥 Usuarios Principales

- Nicole (modo single)
- David (manager de María y Sofía)
- Txell, Jordi, Ona

---

## 🤖 Para Modelos de IA

**Antes de hacer cambios en el código:**

1. Lee **[DOCUMENTACION_TECNICA.md](./DOCUMENTACION_TECNICA.md)** completo
2. Revisa **[PASOS_MIGRACION_FIREBASE.md](./PASOS_MIGRACION_FIREBASE.md)** para el roadmap
3. Consulta la sección de TODOs para prioridades
4. Sigue las convenciones de código documentadas

**Archivos clave:**
- `src/App.jsx` - Estado global y autenticación
- `src/firebase.js` - Configuración Firebase
- `src/utils/userProfiles.js` - Helpers Firestore
- `src/components/CalendarView.jsx` - Vista principal

---

## 📞 Contacto

**Desarrollador**: Reinaldo Moon
**Email**: misterpotatolightyear@gmail.com

---

## 📜 Licencia

Privado - Uso personal

---

**Última actualización**: 17 de marzo de 2026

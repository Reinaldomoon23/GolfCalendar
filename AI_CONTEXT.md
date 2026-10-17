# AI_CONTEXT.md — Players Calendar / RoundTracker
# Leer OBLIGATORIAMENTE antes de cualquier acción en este proyecto

## ¿Qué es este proyecto?
PWA de golf (React 19 + Vite 7 + Firebase 12 + React Router 7).
Permite a jugadoras de golf registrar resultados, seguir torneos en vivo y ver estadísticas.

## PROTOCOLO DE INICIO (para cualquier modelo de IA)

### 1. Lee el estado actual
Antes de escribir código, lee estos dos archivos:
- `LEADERBOARD_PROGRESS.log` → qué está completado y cuál es el próximo paso exacto
- `LEADERBOARD_ROADMAP.md` → contexto técnico completo e instrucciones de implementación

### 2. Confirma antes de actuar
Antes de cada paso, dile al usuario:
- Qué paso del roadmap vas a implementar
- Qué archivos vas a tocar
- Qué resultado se espera

### 3. Al terminar la sesión
1. Actualizar `LEADERBOARD_PROGRESS.log` marcando pasos completados y el próximo
2. Hacer commit y push a GitHub (ver instrucciones de deploy abajo)

---

## Stack técnico

| Campo | Valor |
|---|---|
| Framework | React 19 + Vite 7 |
| Base de datos | Firebase Firestore (tiempo real con onSnapshot) |
| Auth | Firebase Auth |
| Router | React Router 7 |
| CSS | Vanilla CSS inline + variables en index.css |
| Deploy | Vercel (frontend) + Hostinger FTP (dominio reinaldomoon.top) |

## Estructura de carpetas relevante

```
src/
  components/      → Componentes React (CalendarView.jsx es el principal)
  contexts/        → UserDataContext.jsx, AuthContext.jsx, ProfileContext.jsx
  services/        → tournaments.service.js, results.service.js, leaderboard.service.js
  hooks/           → useTournaments.js, useAuth.js, useHandicap.js
  utils/           → userProfiles.js, cache.js, dateHelpers.js
  data/            → tournaments.json, spanish_courses.json
```

## Reglas de desarrollo

1. **No usar alert() ni window.confirm()** — el usuario los ha eliminado expresamente. Usar console.warn/log o UI silenciosa.
2. **Los estilos son inline** — no usar Tailwind ni clases CSS ad-hoc. Usar variables CSS como `var(--color-primary)`.
3. **Firebase siempre asíncrono** — los useEffect con onSnapshot SIEMPRE devuelven la función unsubscribe.
4. **IDs de usuario** — usar siempre `getUserDocId(user)` de `utils/userProfiles.js`, nunca acceder a `user.uid` directamente.
5. **Torneos centralizados** — los IDs con guión bajo (ej: `trofeo-verano_15062026`) son compartidos. Los numéricos son oficiales.

## Deploy

```bash
npm run deploy:all   # build + Vercel + FTP Hostinger
```

Para GitHub (el token puede haber caducado, regenerar si falla):
```bash
git add . && git commit -m "descripción" && git push -u origin main
```

## Contexto del feature en desarrollo: Sistema de Leaderboard
Ver `LEADERBOARD_ROADMAP.md` y `LEADERBOARD_PROGRESS.log` para el estado exacto.

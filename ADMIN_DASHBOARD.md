# Dashboard de Administración - RoundTracker

**Versión**: 1.0
**Fecha**: 22 de marzo de 2026
**Desarrollador**: Reinaldo Moon

---

## 📋 Índice

1. [Introducción](#introducción)
2. [Acceso al Dashboard](#acceso-al-dashboard)
3. [Módulos del Dashboard](#módulos-del-dashboard)
   - [Usuarios](#usuarios)
   - [Torneos](#torneos)
   - [Feature Flags](#feature-flags)
   - [Analytics](#analytics)
   - [Seguridad](#seguridad)
   - [Sistema](#sistema)
4. [Casos de Uso](#casos-de-uso)
5. [Troubleshooting](#troubleshooting)

---

## Introducción

El **Dashboard de Administración** de RoundTracker es un panel de control completo que permite gestionar todos los aspectos de la aplicación sin necesidad de tocar código ni usar Firebase Console.

### ¿Qué puedes hacer desde el dashboard?

- ✅ Crear, editar y eliminar usuarios
- ✅ Gestionar torneos oficiales
- ✅ Habilitar/deshabilitar funcionalidades con Feature Flags
- ✅ Ver métricas y analytics en tiempo real
- ✅ Configurar reglas de seguridad de Firestore
- ✅ Ejecutar utilidades del sistema (limpiar caches, regenerar mappings, etc.)

---

## Acceso al Dashboard

### Requisitos

Para acceder al dashboard necesitas:

1. **Cuenta de usuario en RoundTracker**
2. **Rol de Admin** (`role: "admin"`) en tu perfil de Firestore

### Cómo acceder

1. Inicia sesión en la aplicación
2. Navega a: **https://reinaldomoon.top/GolfTeam/admin**
3. Si tienes permisos, verás el panel de administración
4. Si no tienes permisos, verás un mensaje de "Acceso Denegado"

### Cómo asignar rol de admin a un usuario

**Opción 1: Desde Firebase Console**

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto: `golfscorings-e4338`
3. Firestore Database → `users` → Busca el usuario por UID
4. Edita el documento y agrega/modifica el campo:
   ```javascript
   role: "admin"
   ```
5. Guarda cambios

**Opción 2: Desde el Dashboard (si ya eres admin)**

1. Panel de Administración → **Usuarios**
2. Busca el usuario
3. Clic en **Editar**
4. Cambia el rol a "Admin"
5. Guarda cambios

---

## Módulos del Dashboard

### 👥 Usuarios

**Ruta**: `/admin` → Pestaña "Usuarios"

#### Funcionalidades

1. **Listar todos los usuarios**
   - Tabla con: Nombre, Email, Rol, Licencia federativa
   - Búsqueda en tiempo real por nombre/email/username

2. **Crear nuevo usuario**
   - Botón: **Crear Usuario**
   - Campos requeridos:
     - Username (único, lowercase)
     - Email (único)
     - Contraseña (mínimo 6 caracteres)
     - Nombre completo
     - Nº Licencia (opcional)
     - Rol (player/manager/admin)

3. **Editar usuario existente**
   - Botón: **Editar** (icono lápiz)
   - Permite modificar:
     - Nombre completo
     - Nº Licencia federativa
     - Rol

4. **Eliminar usuario**
   - Botón: **Eliminar** (icono papelera)
   - ⚠️ Acción irreversible
   - Elimina:
     - Perfil del usuario
     - Todos sus resultados
     - Torneos personalizados
     - Preferencias

5. **Resetear contraseña**
   - Botón: **Resetear** (icono llave)
   - Envía email de recuperación al usuario

#### Casos de Uso

**Ejemplo 1: Crear usuario para un jugador nuevo**

```
1. Clic en "Crear Usuario"
2. Completar formulario:
   - Username: maria_lopez
   - Email: maria.lopez@email.com
   - Contraseña: temporal123
   - Nombre: María López
   - Licencia: CB00987654
   - Rol: Player
3. Clic en "Crear Usuario"
4. Compartir credenciales con María
5. María cambia su contraseña en primer login
```

**Ejemplo 2: Cambiar rol de usuario a manager**

```
1. Buscar usuario "david" en la tabla
2. Clic en "Editar"
3. Cambiar rol de "Player" a "Manager"
4. Guardar cambios
5. David ahora puede gestionar otros perfiles
```

---

### 🏆 Torneos

**Ruta**: `/admin` → Pestaña "Torneos"

#### Funcionalidades

1. **Listar torneos oficiales**
   - Tabla con: ID, Nombre, Fechas, Ubicación, Organización
   - Ordenados por fecha (más recientes primero)

2. **Crear torneo oficial**
   - Botón: **Crear Torneo**
   - Campos:
     - ID (número único)
     - Nombre del torneo
     - Fechas (formato: DD/MM/YYYY o DD/MM/YYYY - DD/MM/YYYY)
     - Ubicación
     - Organización (RFEG/FCG/Club/Juvenil/Adultos)
     - Categoría (Juvenil/Adultos/etc.)
     - Tipo (Stroke Play/Match Play/Orden de Mérito)
     - Detalles (opcional)

3. **Editar torneo**
   - Botón: **Editar** (icono lápiz)
   - Permite modificar todos los campos

4. **Eliminar torneo**
   - Botón: **Eliminar** (icono papelera)
   - ⚠️ No elimina los resultados de usuarios asociados al torneo

5. **Exportar a CSV**
   - Botón: **Exportar CSV**
   - Descarga archivo CSV con todos los torneos
   - Útil para backups o análisis externo

#### Casos de Uso

**Ejemplo 1: Agregar torneo oficial de RFEG**

```
1. Clic en "Crear Torneo"
2. Completar:
   - ID: 201
   - Nombre: Campeonato de España Juvenil 2026
   - Fechas: 15/05/2026 - 16/05/2026
   - Ubicación: Real Club de Golf El Prat
   - Organización: RFEG
   - Categoría: Juvenil
   - Tipo: Stroke Play
   - Detalles: 36 hoyos stroke play, categorías Sub-16 y Sub-18
3. Guardar
4. Torneo visible para todos los usuarios
```

---

### 🚩 Feature Flags

**Ruta**: `/admin` → Pestaña "Feature Flags"

#### ¿Qué son los Feature Flags?

Los Feature Flags permiten **habilitar o deshabilitar funcionalidades** de la app sin redeployar código. Esto es útil para:

- ✅ Lanzar features gradualmente (ej: 25% de usuarios)
- ✅ Desactivar features con bugs al instante
- ✅ A/B testing
- ✅ Dark launches (código en producción pero inactivo)

#### Funcionalidades

1. **Lista de features disponibles**
   - Cada feature muestra:
     - Nombre (ej: `FRIENDS_SYSTEM`)
     - Código único (ej: `FF-SOCIAL-001`)
     - Descripción
     - Estado (Activa/Inactiva)
     - Rollout (0-100%)

2. **Activar/Desactivar feature**
   - Toggle button para cada feature
   - Cambios aplican **inmediatamente** para todos los usuarios

3. **Configurar rollout gradual**
   - Slider de 0% a 100%
   - Ejemplo:
     - 0%: Nadie ve la feature
     - 25%: 1 de cada 4 usuarios la ve
     - 100%: Todos la ven

4. **Filtrar por categoría**
   - System
   - Social
   - Premium
   - Optimization

#### Features Disponibles

| Feature | Código | Categoría | Descripción |
|---------|--------|-----------|-------------|
| `ADMIN_DASHBOARD` | FF-SYS-001 | System | Panel de administración completo |
| `ANALYTICS_TRACKING` | FF-SYS-002 | System | Seguimiento con Firebase Analytics |
| `ERROR_MONITORING` | FF-SYS-003 | System | Monitoreo de errores con Sentry |
| `FRIENDS_SYSTEM` | FF-SOCIAL-001 | Social | Sistema de amigos |
| `SHARE_TOURNAMENTS` | FF-SOCIAL-002 | Social | Compartir torneos con amigos |
| `COMPARE_STATS` | FF-SOCIAL-003 | Social | Comparar estadísticas |
| `ADVANCED_STATS` | FF-PREMIUM-001 | Premium | Estadísticas avanzadas (strokes gained) |
| `PDF_EXPORT` | FF-PREMIUM-002 | Premium | Exportar stats a PDF |
| `DARK_MODE` | FF-PREMIUM-003 | Premium | Modo oscuro |
| `PAGINATION` | FF-OPT-001 | Optimization | Paginación de resultados |
| `IMAGE_COMPRESSION` | FF-OPT-002 | Optimization | Compresión de fotos |
| `LAZY_LOADING` | FF-OPT-003 | Optimization | Carga diferida de componentes |

#### Casos de Uso

**Ejemplo 1: Lanzar Sistema de Amigos gradualmente**

```
1. Desarrollar feature con código FF-SOCIAL-001
2. Deploy a producción (feature inactiva por defecto)
3. En dashboard → Feature Flags → FRIENDS_SYSTEM
4. Activar toggle (cambia a "Activa")
5. Configurar rollout al 10% (beta testers)
6. Monitorear por 1 semana
7. Si todo bien, aumentar a 50%
8. Finalmente, subir a 100%
```

**Ejemplo 2: Desactivar feature con bug**

```
1. Detectas un bug crítico en SHARE_TOURNAMENTS
2. En dashboard → Feature Flags
3. Buscar SHARE_TOURNAMENTS
4. Desactivar toggle
5. Feature desaparece inmediatamente para todos
6. Arreglar bug en código
7. Reactivar cuando esté listo
```

---

### 📊 Analytics

**Ruta**: `/admin` → Pestaña "Analytics"

#### Funcionalidades

1. **Métricas principales** (tarjetas)
   - Usuarios Totales
   - Torneos Oficiales
   - Resultados Guardados
   - Usuarios Activos

2. **Botón "Actualizar Estadísticas"**
   - Recarga métricas en tiempo real

3. **Próximamente**:
   - Gráficos de crecimiento de usuarios
   - Torneos más populares
   - Usuarios con más resultados

---

### 🔒 Seguridad

**Ruta**: `/admin` → Pestaña "Seguridad"

#### Funcionalidades

1. **Reglas de Firestore**
   - Visualización de reglas recomendadas para producción
   - Botón "Copiar Reglas" al portapapeles
   - Instrucciones paso a paso para aplicarlas

2. **Estado de seguridad**
   - Banner indicando si las reglas son permisivas (desarrollo) o restrictivas (producción)

3. **Índices de Firestore**
   - Lista de índices recomendados
   - Enlace directo a Firebase Console

#### Reglas de Seguridad Recomendadas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Usuarios - Solo lectura/escritura propia
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid;

      match /{subcollection}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }

    // Mapping usernames (solo lectura)
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // Torneos oficiales (lectura pública)
    match /tournaments/{tournamentId} {
      allow read: if true;
      allow write: if false;
    }

    // Bloquear todo lo demás
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

#### Casos de Uso

**Aplicar reglas de producción**

```
1. Dashboard → Seguridad
2. Clic en "Copiar Reglas"
3. Abrir Firebase Console
4. Firestore Database → Rules
5. Pegar reglas copiadas
6. Clic en "Publish"
7. Confirmar deployment
```

---

### ⚙️ Sistema

**Ruta**: `/admin` → Pestaña "Sistema"

#### Funcionalidades

1. **Limpiar Caches de Hándicap**
   - Elimina todos los caches de hándicap almacenados localmente
   - Los usuarios volverán a descargar su hándicap al entrar

2. **Regenerar Mappings de Usernames**
   - Reconstruye la colección `usernames/` desde `users/`
   - Útil si hay inconsistencias o datos corruptos

3. **Limpiar Datos Huérfanos** (Deshabilitado)
   - Por seguridad, esta función requiere implementación manual

4. **Logs de Operaciones**
   - Muestra logs en tiempo real de las operaciones ejecutadas

#### Casos de Uso

**Ejemplo 1: Limpiar caches tras actualizar lógica de hándicap**

```
1. Desarrollas nueva lógica para calcular hándicap
2. Dashboard → Sistema
3. Clic en "Limpiar Caches"
4. Confirmar acción
5. Todos los usuarios refrescarán su hándicap al entrar
```

**Ejemplo 2: Resolver inconsistencias en mappings**

```
Problema: Un usuario no puede acceder porque su mapping username->uid está corrupto

1. Dashboard → Sistema
2. Clic en "Regenerar Mappings"
3. Esperar a que termine (ver logs)
4. Mappings reconstruidos desde users/
5. Usuario puede acceder normalmente
```

---

## Casos de Uso Completos

### Caso 1: Onboarding de 10 jugadores nuevos

**Contexto**: Un club quiere que 10 jugadores empiecen a usar RoundTracker

**Proceso**:

1. **Crear usuarios masivamente**
   ```
   Dashboard → Usuarios → Crear Usuario (x10)
   - juan_perez / juan@club.com / temporal123
   - ana_garcia / ana@club.com / temporal123
   - ... (8 más)
   ```

2. **Compartir credenciales**
   - Enviar email a cada jugador con su usuario/password

3. **Primer login de usuarios**
   - Jugadores entran con credenciales temporales
   - Configuran su perfil (foto, licencia, etc.)
   - Cambian contraseña

4. **Configurar torneos para el club**
   ```
   Dashboard → Torneos → Crear Torneo
   - Torneo mensual del club
   - Fechas, ubicación, etc.
   ```

5. **Habilitar features gradualmente**
   ```
   Dashboard → Feature Flags → FRIENDS_SYSTEM
   - Activar para 50% de usuarios (5 jugadores)
   - Monitorear feedback
   - Si es positivo, activar para 100%
   ```

---

### Caso 2: Detectar y resolver bug crítico en producción

**Contexto**: Un usuario reporta que la app crashea al compartir torneos

**Proceso**:

1. **Desactivar feature inmediatamente**
   ```
   Dashboard → Feature Flags → SHARE_TOURNAMENTS
   - Desactivar toggle
   - Feature desaparece para todos al instante
   ```

2. **Investigar y arreglar bug**
   - Revisar logs
   - Arreglar código
   - Deploy

3. **Reactivar gradualmente**
   ```
   Dashboard → Feature Flags → SHARE_TOURNAMENTS
   - Activar con rollout 10% (beta testers)
   - Esperar 24h
   - Si OK, subir a 100%
   ```

---

### Caso 3: Migrar a reglas de seguridad restrictivas

**Contexto**: Tienes 50 usuarios en producción con reglas permisivas (modo desarrollo)

**Proceso**:

1. **Backup de datos**
   ```
   Firebase Console → Firestore → Export
   - Exportar toda la BD
   - Guardar en Cloud Storage
   ```

2. **Copiar reglas de producción**
   ```
   Dashboard → Seguridad → Copiar Reglas
   ```

3. **Aplicar en Firebase**
   ```
   Firebase Console → Firestore → Rules
   - Pegar reglas
   - Publish
   ```

4. **Testing**
   - Login con varios usuarios
   - Verificar que pueden ver sus datos
   - Verificar que NO pueden ver datos ajenos

5. **Monitoreo**
   ```
   Dashboard → Analytics
   - Ver que usuarios siguen activos
   - Revisar que no hay errores de permisos
   ```

---

## Troubleshooting

### Problema: No puedo acceder al dashboard (error 403)

**Solución**:

1. Verifica que tu usuario tiene `role: "admin"` en Firestore:
   ```
   Firebase Console → Firestore → users → {tu-uid} → role
   ```

2. Si no existe el campo, agrégalo manualmente:
   ```javascript
   role: "admin"
   ```

3. Cierra sesión y vuelve a entrar

---

### Problema: Los Feature Flags no se aplican

**Solución**:

1. Verifica que la feature existe en `src/config/featureFlags.js`

2. Asegúrate de que el código de la app verifica la feature:
   ```javascript
   import { isFeatureEnabled } from './config/featureFlags';

   if (isFeatureEnabled('FRIENDS_SYSTEM', user)) {
     // Mostrar funcionalidad
   }
   ```

3. Recarga la app con Ctrl+Shift+R (hard refresh)

---

### Problema: Error al crear usuario (email-already-in-use)

**Solución**:

1. Verifica que el email no esté en uso:
   ```
   Firebase Console → Authentication → Users
   Buscar email
   ```

2. Si existe pero está corrupto:
   - Elimina el usuario de Authentication
   - Vuelve a crearlo desde el dashboard

---

### Problema: Las reglas de Firestore bloquean al admin

**Solución**:

Agrega regla especial para admins:

```javascript
match /users/{uid} {
  allow read, write: if request.auth != null && (
    request.auth.uid == uid ||
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
  );
}
```

---

## Próximas Mejoras

### Short-term (1-2 semanas)

- [ ] Gráficos de Analytics con Chart.js
- [ ] Exportar usuarios a CSV
- [ ] Importar torneos desde CSV
- [ ] Buscar resultados de cualquier usuario

### Medium-term (1 mes)

- [ ] Editor visual de reglas de Firestore (deploy desde dashboard)
- [ ] Logs de auditoría (quién hizo qué y cuándo)
- [ ] Notificaciones push a usuarios desde dashboard

### Long-term (2+ meses)

- [ ] Dashboard de métricas avanzadas (Google Analytics integration)
- [ ] Sistema de backups automáticos
- [ ] A/B testing integrado con Feature Flags

---

## Contacto y Soporte

**Desarrollador**: Reinaldo Moon
**Email**: misterpotatolightyear@gmail.com

**Documentación adicional**:
- [README.md](./README.md)
- [DOCUMENTACION_TECNICA.md](./DOCUMENTACION_TECNICA.md)
- [PLAN_MAESTRO.md](./PLAN_MAESTRO.md)

---

**Última actualización**: 22 de marzo de 2026
**Versión del documento**: 1.0

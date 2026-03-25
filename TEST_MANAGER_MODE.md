# 🧪 Test Manual - Manager Mode (David → María/Sofía)

**Fecha**: 18 de marzo de 2026
**Objetivo**: Verificar que las reglas de Firestore permiten el manager mode

---

## ✅ Test 1: Login como David y cambiar a María

### Pasos:

1. **Abre la app en tu navegador**
   ```
   https://reinaldomoon.top/GolfTeam/
   ```

2. **Login como David**
   - Usuario: `david`
   - Contraseña: `Boixader`

3. **Verificar que ves las fotos de perfil**
   - Deberías ver 3 fotos: David (grande), María y Sofía (pequeñas)
   - Si NO ves a María y Sofía, hay un problema con `managed_users`

4. **Cambiar a perfil de María**
   - Haz clic en la foto pequeña de María
   - El nombre debería cambiar a "María Boixader" (o su nombre completo)

5. **Verificar datos de María**
   - ¿Aparecen torneos en el calendario?
   - ¿Puedes ver resultados guardados?
   - ¿Funciona el hándicap?

### ✅ Resultado esperado:
- Se pueden ver y editar todos los datos de María
- No hay errores en la consola del navegador (F12 → Console)

### ❌ Si falla:
- Abre la consola del navegador (F12)
- Busca errores relacionados con Firestore
- Toma screenshot y comparte

---

## ✅ Test 2: Login directo como María

### Pasos:

1. **Logout de David**
   - Click en el botón de logout (arriba derecha)

2. **Login como María**
   - Usuario: `maria`
   - Contraseña: `Boixader`

3. **Verificar datos propios**
   - ¿Aparecen torneos?
   - ¿Puedes crear un torneo custom?
   - ¿Puedes añadir un resultado?

### ✅ Resultado esperado:
- María puede acceder a sus propios datos
- Puede crear, editar y eliminar sus torneos y resultados

### ❌ Si falla:
- Revisa la consola para errores de permisos

---

## ✅ Test 3: Modo Live Público (sin login)

### Pasos:

1. **Logout (si estás logueado)**

2. **Crea un resultado en vivo con María**
   - Primero login como María
   - Ve a un torneo
   - Añade resultados
   - Comparte la URL de live

3. **Abre la URL en ventana de incógnito (sin login)**
   - Ejemplo: `https://reinaldomoon.top/GolfTeam/live/maria/123`

4. **Verificar que se ve la scorecard**
   - Deberías poder ver los resultados SIN estar logueado

### ✅ Resultado esperado:
- Scorecards públicas funcionan sin autenticación

### ❌ Si falla:
- Revisa las reglas de `users/{userId}/results/{resultId}`

---

## 🔍 Debug: Verificar Datos en Firestore Console

Si los tests fallan, verifica directamente en Firebase Console:

1. **Ve a Firestore Database**
   ```
   https://console.firebase.google.com/project/golfscorings-e4338/firestore
   ```

2. **Busca el documento de María**
   - Navega a: `users` → busca documento con `username: "maria"`
   - Verifica que tiene `uid` (no vacío)

3. **Verifica el documento de David**
   - Busca documento con `username: "david"`
   - Verifica campo `managed_users`: debe ser `["maria", "sofia"]`

4. **Verifica datos de María**
   - Dentro del documento de María, ve a subcollection `results`
   - ¿Hay documentos?
   - Si NO hay documentos, necesitas migrar datos

---

## 🚨 Problemas Comunes

### Problema 1: No se ven María y Sofía en el selector

**Causa**: David no tiene `managed_users` configurado
**Solución**: Actualiza el documento de David en Firestore:
```javascript
managed_users: ["maria", "sofia"]
```

### Problema 2: Error "Missing or insufficient permissions"

**Causa**: Las reglas no se deployaron correctamente
**Solución**:
1. Ve a Firestore Console → Rules
2. Verifica que las reglas incluyen `isManagerOf()`
3. Re-deploy: `firebase deploy --only firestore:rules`

### Problema 3: María no tiene torneos

**Posibles causas**:
1. Los datos están en `users/maria/results` pero María tiene `uid` diferente
2. Nunca se han guardado datos para María
3. Los datos no se migraron a `users/{uid}/results`

**Solución**: Ejecutar script de migración (ver abajo)

---

## 🔄 Si necesitas migrar datos de María

Si María tiene un `uid` diferente a "maria", ejecuta:

```bash
node scripts/migrate_user_ownership_to_uid.js
```

Esto moverá todos los datos de `users/maria` a `users/{maria_uid}`

---

## 📊 Checklist de Verificación

- [ ] David login exitoso
- [ ] David ve fotos de María y Sofía
- [ ] David puede cambiar a perfil de María
- [ ] David puede ver/editar datos de María
- [ ] María login directo exitoso
- [ ] María puede ver sus propios datos
- [ ] María puede crear/editar torneos
- [ ] Scorecard en vivo funciona sin login
- [ ] No hay errores en consola del navegador
- [ ] Hándicap funciona para ambos perfiles

---

## 📝 Reporte de Testing

Por favor, completa después de hacer las pruebas:

```
TEST 1 (David → María): ✅ / ❌
- Fotos visibles:
- Cambio de perfil:
- Datos de María visibles:
- Errores en consola:

TEST 2 (María directa): ✅ / ❌
- Login exitoso:
- Torneos visibles:
- Puede crear torneo:
- Errores en consola:

TEST 3 (Live público): ✅ / ❌
- URL funciona sin login:
- Scorecard visible:
- Errores en consola:
```

---

**Última actualización**: 18 de marzo de 2026

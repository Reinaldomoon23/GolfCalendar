# Scalability Roadmap

## Objetivo
Preparar `Players Calendar` para crecer desde el estado actual a una arquitectura segura y mantenible para miles de usuarios, sin romper produccion durante la transicion.

## Punto de partida actual
- Frontend React/Vite ya desplegado en produccion.
- Firebase Authentication ya integrado.
- Firestore ya usado para resultados, preferencias, perfiles y torneos.
- Aun existen dependencias legacy en PHP.
- Parte del modelo sigue girando en torno a `username`.
- Existen secretos y scripts sensibles que deben quedarse fuera del cliente y del repositorio publico.

## Riesgos actuales

### 1. Seguridad
- No deberian existir credenciales sensibles en frontend.
- No deberian subirse al repo archivos con passwords reales o scripts de migracion que las contengan.
- Las reglas de Firestore aun no estan cerradas para un escenario multiusuario serio.

### 2. Modelo de datos
- `username` es comodo para UX, pero no es una base ideal para seguridad ni ownership.
- Para crecer bien, la entidad principal del usuario debe ser `uid`.

### 3. Backend
- La app aun depende parcialmente de PHP legacy.
- Algunas operaciones sensibles siguen acopladas a cliente o a endpoints historicos.

### 4. Operacion
- Falta una separacion clara entre staging y production a nivel de release process.
- Falta observabilidad minima: logs utiles, monitorizacion, rollback claro.

## Arquitectura objetivo

### Identidad
- `Firebase Authentication` como unica fuente de verdad para login y sesion.
- `uid` como identificador canonico interno.
- `username` como alias publico, nunca como clave principal de seguridad.

### Firestore
- `users/{uid}` para perfil privado/base.
- `users/{uid}/results/{resultId}`
- `users/{uid}/custom_tournaments/{tournamentId}`
- `users/{uid}/settings/preferences`
- `public_profiles/{uid}` si hace falta exponer datos publicos.
- `usernames/{username}` para resolver nombres amigables a `uid`.

### Archivos
- Fotos mediante `Cloudflare R2` o `Firebase Storage`.
- Subidas firmadas desde backend o funcion serverless.
- Nunca exponer credenciales de almacenamiento en el cliente.

### Backend
- Migrar logica sensible a `Firebase Functions`, `Cloud Run` o un backend Node pequeno.
- Mantener PHP solo como capa temporal mientras se reemplaza.

## Plan por fases

## Fase 1. Endurecimiento inmediato
- Quitar secretos del frontend.
- Excluir definitivamente del repo:
  - credenciales de usuarios
  - scripts con passwords
  - archivos de migracion sensibles
- Cerrar reglas basicas de Firestore para que cada usuario solo pueda acceder a su propio espacio.
- Confirmar que produccion ya usa solo login Firebase.

### Resultado esperado
- Riesgo bajo de filtracion.
- Autenticacion consistente.
- Menor dependencia de configuraciones manuales peligrosas.

## Fase 2. Modelo canonico por UID
- Introducir `users/{uid}` como documento canonico.
- Mantener compatibilidad temporal con `username`.
- Crear mapping `usernames/{username} -> uid`.
- Adaptar lecturas y escrituras para que usen `uid` como ownership real.

### Resultado esperado
- Reglas de seguridad simples.
- Menos fragilidad en cambios de username.
- Mejor base para escalar.

## Fase 3. Retirada progresiva de PHP
- Retirar `login.php` y `create_user.php`.
- Retirar endpoints de guardado legacy cuando el frontend ya no dependa de ellos.
- Evaluar reemplazo del flujo de handicap:
  - mantenerlo temporalmente
  - o moverlo a backend serverless si el coste/operacion lo permite

### Resultado esperado
- Menor deuda tecnica.
- Menos puntos de fallo duplicados.

## Fase 4. Backend seguro para operaciones sensibles
- Subida de fotos con URLs firmadas o backend intermedio.
- Gestion de managers y permisos desde backend.
- Automatizar altas, reseteos y migraciones sin scripts manuales locales.

### Resultado esperado
- Cliente mas ligero y seguro.
- Menos exposicion de logica critica.

## Fase 5. Rendimiento y coste
- Reducir listeners en tiempo real donde no aporten valor real.
- Paginar resultados historicos.
- Cargar solo temporada actual por defecto.
- Revisar indices de Firestore segun consultas reales.
- Separar datos publicos de privados para evitar lecturas innecesarias.

### Resultado esperado
- Mejor coste por usuario.
- Menor latencia.
- Mejor comportamiento con volumen real.

## Fase 6. Operacion y releases
- Definir CI/CD real.
- Staging estable antes de pasar a production.
- Checklist de release.
- Backup/export programado.
- Rollback definido.

### Resultado esperado
- Despliegues mas seguros.
- Menor riesgo operativo.

## Recomendacion concreta para este proyecto

### Haz primero
1. Reglas Firestore.
2. Sacar secretos del cliente y del repo.
3. Confirmar que el login viejo ya no se usa en produccion.
4. Planificar la migracion de `username` a `uid`.

### Haz despues
1. Sustituir guardados legacy PHP.
2. Mover subida de fotos a backend firmado.
3. Crear mapping publico de usernames.
4. Optimizar listeners y consultas.

## Decision importante
Si el producto va a crecer de verdad, no intentaria consolidar el modelo actual basado en `username`.
Lo usaria solo como compatibilidad temporal mientras migro ownership y seguridad a `uid`.

## Entregable futuro sugerido
Cuando toque ejecutar esta hoja de ruta, el siguiente documento util deberia ser:
- `UID_MIGRATION_PLAN.md`

Ese plan ya seria tecnico y detallado: colecciones, reglas, migraciones, compatibilidad y orden exacto de despliegue.

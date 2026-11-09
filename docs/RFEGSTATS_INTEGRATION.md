# Integración de estadísticas RFEGStats

## Objetivo y límites

RoundTracker captura las estadísticas de cada hoyo tanto en torneos como en vueltas libres, las conserva en un área privada de Firestore y permite al usuario iniciar una transferencia a su propia cuenta de RFEGStats. No se envía nada automáticamente al guardar resultados.

La web de la Federación no ofrece una API pública identificada. La transferencia automatizada replica los formularios HTML autenticados que usa la web. El servidor vuelve a inspeccionar el formulario y los nombres de campos de hoyo antes de escribir. Si no reconoce el protocolo, detiene el envío. La exportación CSV sigue disponible como alternativa manual.

## Datos capturados por hoyo

| Campo RoundTracker | Significado / opciones | Campo RFEGStats |
|---|---|---|
| HCP | Índice del hoyo, 1–18; se prellena del catálogo y se puede corregir | handicap del hoyo |
| Par | Par del hoyo del campo | par |
| Golpes | Resultado por hoyo | resultado |
| FIR | Calle cogida / fallo izquierda / fallo derecha; solo par 4 y 5 | 2 / 1 / 3; omitido en par 3 |
| DTH | Distancia prevista al green (categorías en metros) | dth |
| GIR | En regulación / fallado / sin posibilidad | 1 / 2 / 3 |
| Putts | Número por hoyo | putts |
| D1P | Distancia del primer putt; hoyo embocado desde fuera del green = 0 (codificado como 0.1 por RFEGStats) | dp |
| D2P | Distancia del segundo putt; requerida con dos o más putts | dp2 |
| Recuperación | Conseguida / no conseguida, lie F/R/B y distancia | recuperacion / lie / rec_dth |
| Penalidades | Tee y otras, 0–2 cada una | tee_penalty / other_penalty |
| Código RoundTracker | Identificador persistente `RT-…` | Descripción de la ronda; se usa para evitar duplicados |
| Condiciones y observaciones | Seco, húmedo, frío, viento y texto libre | Campos de la ronda |

Las distancias de recuperación de más de 40 m se marcan como tales; no cuentan para la estadística de recuperación definida por las instrucciones de uso. FIR queda deshabilitado en par 3. Las reglas completas de captura recibidas del usuario están en el material de instrucciones del proyecto.

## Privacidad y credenciales

- El nombre de usuario y contraseña de RFEGStats solo se envían al endpoint del servidor por HTTPS.
- El servidor valida el acceso y cifra las credenciales con AES-256-GCM antes de guardarlas bajo `users/{uid}/integrations/rfegstats`.
- La clave `RFEGSTATS_CREDENTIALS_KEY` solo debe existir como secreto de Vercel; nunca en el frontend, Git o logs.
- Las estadísticas hoyo a hoyo se guardan en `users/{userDocId}/rfeg_statistics/{tournamentId}`. Las reglas de Firestore permiten acceder al propietario, sus managers autorizados y administradores.
- Los documentos de resultados públicos eliminan cualquier `rfeg` heredado antes de mostrarlos o guardarlos. Las tarjetas públicas y el leaderboard no reciben estas estadísticas.
- Credenciales y catálogo nunca se registran en logs. El usuario puede sustituir o eliminar su conexión.

## Flujo de transferencia

1. En la tarjeta de un torneo o de una vuelta libre, abrir “Estadísticas avanzadas RFEG”.
2. Completar los campos faltantes de los 18 hoyos y corregir HCP/par si el catálogo no los conoce.
3. Conectar y validar las credenciales; cargar catálogo oficial y confirmar manualmente club y recorrido.
4. Revisar el código, fecha, golpes, condiciones y destino.
5. Pulsar “Confirmar envío a RFEGStats”. El backend comprueba duplicados, verifica que el formulario siga teniendo los campos esperados, crea la ronda y confirma los hoyos escritos.
6. Si la respuesta es ambigua después de empezar a escribir, la operación queda en revisión y no permite reintentar a ciegas.

El código de ronda se conserva entre plataformas para localizar el mismo registro. Ninguna ronda se transmite durante compilaciones o despliegues.

## Publicación y operación

- APIs: `api/rfegstats_credentials.js`, `api/rfegstats_transfer.js` y `api/_rfegstats_server.js`.
- Configuración de endpoints: `src/config/api.js`.
- Reglas privadas: `firestore.rules`.
- Mantener las dependencias y `pnpm-lock.yaml` sincronizados. Vercel está fijado a Node.js 24.x; Firebase Admin 13 usa `jwks-rsa` 3 para evitar la incompatibilidad CommonJS/ESM observada en Node.js 26.
- Después de cualquier cambio en reglas, desplegarlas al proyecto Firebase `golfscorings-e4338` desde `MyGolfLife`.
- Revisar el formulario actual de la Federación antes de reintentar si RFEGStats cambia. No usar endpoints no documentados distintos de las rutas del formulario comprobadas.

## Estado de verificación

Compilación Vite y ESLint de los archivos de la integración: correctos salvo avisos de hooks preexistentes en CalendarView y MobileScorecardEditor. Producción responde 401 a una petición sin sesión, confirmando que la función inicia y exige autenticación. No se ha transferido una ronda real. La primera prueba de extremo a extremo debe ser una ronda completa que el usuario seleccione explícitamente; comprobar tanto el registro RFEGStats como su código RT antes de declarar la transferencia validada.

# Resumen de Cambios de la Sesión - 31 Enero 2026

Este documento detalla todas las modificaciones realizadas durante la sesión de trabajo actual en la aplicación **Players Calendar**.

## 1. Gestión de Usuarios y Perfil

*   **Nuevo Usuario Agregado:**
    *   Se ha dado de alta a **Valentina Corretja de Miguel** (`valentina`) en `users.json`.
    *   Contraseña hash generada y configurada.
    *   Datos de federación (`CB01965090`) y foto de perfil vinculados.

*   **Corrección de Datos:**
    *   Se añadió el `federation_id` faltante para el usuario `nicole` en `users.json`.

*   **Sincronización de Perfil (App.jsx):**
    *   **Soporte Multi-Formato:** Se actualizó la lógica de sincronización para soportar tanto `Array` como `Object` al leer `users.json`, mejorando la compatibilidad con diferentes versiones del servidor.
    *   **Eliminación de Bucles:** Se corrigió una dependencia en `useEffect` (cambiado a `[user?.username]`) y se añadieron comprobaciones de igualdad estricta para evitar re-renderizados infinitos y bucles de actualización.
    *   **Edición de Perfil:** Se implementó una **recarga forzada de datos** (`fetch` en segundo plano) al pulsar el botón de editar nombre, garantizando que campos como el "Nº Licencia" aparezcan rellenos si existen en el servidor, incluso si la caché local era antigua.

*   **Foto de Perfil:**
    *   Se refactorizó la lógica de construcción de la URL de la imagen (`src`) para manejar correctamente rutas relativas y absolutas, evitando dobles barras y garantizando que el parámetro de "cache-busting" (`?t=...`) se aplique correctamente.

*   **Botón de Hándicap:**
    *   **Estabilidad Visual:** Se eliminó el cambio de texto "Actualizando..." que causaba saltos en el diseño. Ahora solo gira el icono mientras el texto permanece fijo.
    *   **Ancho Fijo:** Se aplicó un `minWidth` al botón para evitar movimientos bruscos.

## 2. Interfaz y Diseño de Tarjetas (CalendarView)

*   **Rediseño de Eventos "Valederos":**
    *   **Estilo Premium:** Se implementó un fondo con degradado suave (`linear-gradient` amarillo pálido).
    *   **Bordes:** Se aplicó un borde dorado más grueso (`2px solid #D97706`) y una sombra más pronunciada para destacar estas fichas sobre el resto.
    *   **Etiqueta:** La etiqueta "VALEDERA" ahora es amarillo brillante con texto oscuro y se añadió un icono de **Trofeo** para mayor visibilidad.

*   **Limpieza Visual (Feedback de Usuario):**
    *   **Eliminación de Perfil Izquierdo:** Se eliminó la franja de color vertical (border-left) de todas las tarjetas para un diseño más limpio y "encuadrado".
    *   **Eventos en Conflicto:** Ahora se marcan con un borde rojo completo (`2px solid`) en lugar de solo el lateral.

*   **Ajustes Generales:**
    *   Se optimizó el contenedor de etiquetas (`badges`) con `flex-wrap` para evitar solapamientos con el botón de menú en pantallas pequeñas.

## 3. PWA (Progressive Web App) y Despliegue

*   **Sistema de Actualizaciones:**
    *   Se cambió la configuración de VitePWA a `registerType: 'prompt'`.
    *   Se implementó el hook `useRegisterSW` en `App.jsx`.
    *   **Banner de Notificación:** Se añadió un aviso flotante "Nueva versión disponible" con un botón "Actualizar" que permite al usuario forzar la recarga de la aplicación cuando hay cambios desplegados.

*   **Datos de Torneos:**
    *   Corrección en el torneo "Puntuable Nacional Juvenil" (ID 110): marcado como `grand_prix`, añadido a grupos correctos y asignado al campo "Lauro".


## 4. Guía de Migración a Next.js

Si decides migrar este proyecto a **Next.js**, ten en cuenta las siguientes adaptaciones para mantener las funcionalidades implementadas en esta sesión:

### A. Gestión de Imágenes y Rutas
*   **Componente `<Image>`:** Reemplaza las etiquetas `<img>` estándar por `next/image` para optimización automática.
    *   *Nota:* Para fotos de perfil dinámicas externas (si las hay), deberás configurar `remotePatterns` en `next.config.js`.
*   **Rutas Estáticas:** En Next.js, los archivos en `public/` se sirven igual, pero asegúrate de usar `/` como raíz. Evita la lógica condicional `IS_MULTI` para rutas de assets si usas un dominio propio.

### B. PWA (Progressive Web App)
*   **Plugin:** Reemplaza `vite-plugin-pwa` por **`@ducanh2912/next-pwa`** o `next-pwa`.
*   **Configuración:** Configura el plugin en `next.config.js`.
*   **Actualizaciones:** El hook `useRegisterSW` es específico de Vite. En Next.js, deberás usar la API nativa de Service Workers en un `useEffect` o un hook personalizado adaptado para detectar el evento `waiting` del SW y mostrar el banner de "Nueva versión".

### C. Backend y API (Sustitución de PHP)
La lógica actual depende de scripts PHP (`users.json`, `get_handicap.php`). En Next.js, debes migrar esto a **API Routes** (App Router):

1.  **`app/api/users/route.js`:**
    *   Reemplaza la lectura de `users.json` con `fs.promises.readFile` (Node.js).
    *   Implementa manejadores `GET` y `POST` para leer y actualizar el perfil.
2.  **`app/api/handicap/route.js`:**
    *   Migra la lógica de `get_handicap.php` a Node.js.
    *   Usa librerías como `pdf-parse` para leer el PDF de la federación en lugar de la librería PHP.
    *   Usa `axios` o `fetch` para descargar el PDF.

### D. Renderizado y Datos
*   **Server Components (RSC):** Aprovecha los componentes de servidor para cargar `tournaments.json` y `users.json` directamente en el servidor antes de enviar el HTML, mejorando el SEO y la velocidad inicial.
*   **Revalidación:** Usa `revalidatePath` o `revalidateTag` para actualizar los datos de torneos sin reconstruir toda la app.

### E. Estilos (CSS)
*   Copia el contenido de `index.css` a `app/globals.css`.
*   Las variables CSS (`--color-valedera`, etc.) funcionarán igual.
*   Considera usar **Tailwind CSS** para facilitar el mantenimiento de estilos complejos como los degradados y bordes de las tarjetas Valederas.

---
*Documento generado automáticamente por Antigravity el 31 de Enero de 2026.*

## 5. Actualización de Estadísticas y Despliegue Seguro (2 de Febrero 2026)

*   **Gráfica de Rendimiento (StatsView):**
    *   **Nueva Métrica:** Se ha reemplazado la gráfica de "Distribución de Golpes" por **"Rendimiento (Últimas Vueltas)"**.
    *   **Lógica:** Ahora muestra la diferencia de golpes respecto al par (+/-) para las últimas 10 rondas jugadas.
    *   **Visualización:** Barras de colores semánticos (Verde < 0, Rojo > 0, Gris = 0) y etiquetas detalladas en el tooltip.

*   **Despliegue Robusto (Seguridad de Datos):**
    *   **Protección de Datos de Usuario:** Se ha reescrito el script de despliegue (`deploy_multi.cjs`) para usar una **lista blanca (allowlist)**. Ahora solo se suben archivos de sistema (`tournaments.json`, `api/*.php`), garantizando que los archivos personales (`results_*.json`, `prefs_*.json`) NUNCA sean sobrescritos por el despliegue.
    *   **Backup Automático:** Se ha implementado `backup_remote_data.cjs`, que descarga una copia de seguridad de todos los datos críticos del servidor (`results`, `custom_tournaments`) a la carpeta local `server_backups/` antes de realizar cualquier cambio en producción.

*   **Arquitectura de Datos:**
    *   Se ha confirmado y reforzado el modelo de datos donde `tournaments.json` actúa como catálogo base, mientras que `custom_tournaments_usuario.json` y `results_usuario.json` almacenan las personalizaciones y resultados de cada jugador de forma independiente.
    *   Se ha corregido un problema de "caché" en la carga de preferencias añadiendo un parámetro de timestamp (`?t=...`) en `App.jsx`, asegurando la sincronización inmediata entre dispositivos.

## 6. Creación de Usuario Adicional (2 de Febrero 2026)

*   **Nuevo Usuario:** Se ha creado el usuario **Maria Boixader** (`maria`).
    *   **Contraseña:** Configurada hash para "Boixader".
    *   **Despliegue:** Se ha utilizado un script dedicado (`upload_users_only.cjs`) para subir `users.json` al servidor sin comprometer otros datos.

## 7. Corrección Crítica en Despliegue (2 de Febrero 2026 - Final)

*   **Problema Detectado:** El script de despliegue original `deploy_multi.cjs` sobrescribía archivos de usuario (`users.json`, `profiles/`) porque la regla `include: "api/**/*"` era demasiado agresiva, a pesar de las exclusiones.
*   **Solución Aplicada:**
    *   Se modificó el `include` para ser explícito: `api/*.php`.
    *   Se eliminó completamente la carpeta `profiles/` de la subida.
    *   **Resultado:** Ahora el despliegue es estrictamente de **Código y Configuración Estática**, respetando al 100% los datos generados por los usuarios en el servidor.

## 8. Seguimiento de Putts y Backups Automáticos (5 de Febrero 2026)

*   **Seguimiento de Putts (Nueva Funcionalidad):**
    *   **Interfaz Scorecard:** Añadida opción "Incluir Putts" en la vista de edición de resultados (`CalendarView.jsx`). Al activarse, despliega una fila extra en la tarjeta para introducir los putts hoyo a hoyo.
    *   **Almacenamiento:** Los datos se guardan en el objeto `results` bajo la clave `putts` para cada vuelta, asegurando persistencia sin necesidad de cambios en la base de datos (JSON).
    *   **Estadísticas:** Se ha añadido una nueva tarjeta "PUTTS" en la pestaña de Estadísticas (`StatsView.jsx`) que muestra: Rondas contabilizadas, Media de putts, Mejor marca y Total acumulado.
    *   **Lógica Interna:** Refactorización de `StatsView.jsx` para corregir errores de anidamiento JSX y permitir la visualización correcta de múltiples secciones de estadísticas y ahora contabiliza los putts totales introducidos manualmente.

*   **Mejoras de Usabilidad (Feedback Usuario):**
    *   **Input Directo de Putts:** Se ha eliminado el checkbox "Incluir Putts" para simplificar la interfaz. Ahora, la casilla de **Total de Putts** aparece siempre junto a "Stb", lista para usarse si se desea.
    *   **Estadísticas Condicionales:** La tarjeta de estadísticas "PUTTS" ahora es inteligente. Si el usuario no ha introducido datos de putts en ninguna ronda, la tarjeta se oculta automáticamente. Si hay datos, aparece.
    *   **Sincronización:** Si el usuario decide rellenar la tarjeta detallada hoyo a hoyo, el total se actualiza automáticamente.

*   **Implementación de MonthGridView:**
    *   Modified `src/components/CalendarView.jsx` to include a new view mode for a monthly calendar.
    *   Created `src/components/MonthGridView.jsx` to render the calendar grid.
    *   Implemented toggle buttons to switch between "List" and "Month" views in the Calendar tab.
    *   Updated filtering logic to show all tournaments for the selected month when in "Month" view, bypassing "Upcoming/All" filters.
    *   Ensured the new view is responsive and visually appealing.
    *   Consider how to integrate this new view with the existing navigation (e.g., a new button or tab).
    *   **Despliegue en Staging:** La nueva funcionalidad ha sido desplegada exitosamente en el entorno de pruebas: `https://reinaldomoon.top/GolfTeam_Staging/`.
    *   **Despliegue en Staging:** La nueva funcionalidad ha sido desplegada exitosamente en el entorno de pruebas: `https://reinaldomoon.top/GolfTeam_Staging/`.
    *   **Refinamiento UI (Feedback):**
        *   **Botones:** Se han simplificado a iconos más grandes (24px) con descripciones claras ("tooltip") al pasar el ratón, eliminando el texto para una interfaz más limpia.
        *   **Datos en Calendario:** Ahora las tarjetas de torneo en la vista mensual muestran también el **nombre del campo** con mayor tamaño y opacidad para garantizar su lectura.
    *   **Fuente de Datos:** Se ha modificado la aplicación para que intente cargar la lista de torneos oficial (`tournaments.json`) directamente desde el servidor al iniciar.
        *   Esto evita que versiones antiguas compiladas en la app sobrescriban visualmente los datos actualizados en el servidor.
        *   Si no encuentra el archivo online, usa la versión empaquetada como respaldo.
    *   **Despliegue en Producción:** Tras validar las nuevas funcionalidades en Staging, se ha realizado el **despliegue final exitoso** en el entorno oficial **GolfTeam** (`https://reinaldomoon.top/GolfTeam/`).
        *   Los scripts de despliegue han protegido correctamente los archivos de datos críticos (`results_*.json`, `users.json`).
        *   Se han activado los backups automáticos en el servidor.
    *   **Mejoras en Estadísticas:** Se ha implementado un sistema de **filtrado avanzado** en la vista de estadísticas. El usuario ahora puede visualizar su rendimiento filtrando por:
        *   **Últimos Torneos:** 5, 10, 15, 20 o Todos.
        *   **Por Mes:** Seleccionando un mes específico (ej. Febrero 2026).
        *   **Por Año:** Seleccionando un año completo (ej. 2026), pensando en el histórico futuro.
    *   **Selector de Temporada:** Se ha sustituido el texto estático "Temporada 2026" del encabezado por un **desplegable dinámico**. Al seleccionar otro año (cuando haya datos disponibles), el Calendario filtrará automáticamente los torneos de esa temporada.
        *   **Corrección de Fechas:** Se ha corregido un bug en el parseo de fechas para torneos **multidía** (ej. "31/01/2026 - 01/02/2026"). Ahora la aplicación extrae correctamente el año de inicio para asignarlos a la temporada correspondiente.
    *   **Mejora en Historial de Hándicap:** Se ha optimizado la lista de historial para **ocultar valores duplicados consecutivos**. Ahora solo se muestran las fechas donde hubo un cambio real en el hándicap o la primera entrada, evitando listas redundantes de "4, 4, 4...". 

*   **Sistema de Copias de Seguridad (Backups):**
    *   **Rotación Diaria:** Implementado script `public/api/backup_rotation.php` que gestiona 3 copias rotativas diarias (`backup_1`, `backup_2`, `backup_3`) de toda la carpeta `data/`.
    *   **Automatización:** Se ha integrado la llamada a este sistema dentro de `save_results.php`. Al guardar resultados, el servidor comprueba si ya existe backup del día de hoy; si no, ejecuta la rotación automáticamente antes de guardar los nuevos datos.
    *   **Despliegue:** Se ha actualizado el despliegue para incluir estos nuevos scripts de seguridad en el servidor.


*   **Detección Dinámica de Conflictos:**
    *   **Lógica Anterior:** Solo comparaba si el texto de la fecha era idéntico.
    *   **Nueva Lógica:** Parsea las fechas y detecta solapamientos reales en el tiempo (ej: un torneo del 14-15 de Marzo entra en conflicto con uno del 15 de Marzo, aunque el texto sea diferente).


## 9. Guía de Actualización para Next.js (Resumen Técnico)

Para trasladar estas funcionalidades al proyecto hermano en Next.js, deben replicarse los siguientes elementos clave:

### A. Estado Global (Contexto de Temporada)
*   **Gestión de Temporada:** En `App.jsx` (o tu `Layout/Context` principal en Next.js), se ha añadido un estado global para `currentSeason` y `availableSeasons`.
*   **Lógica de Extracción:**
    ```javascript
    // Helper para extraer el año de inicio (Soporta rangos "31/01/2026 - 01/02/2026")
    const getYear = (dateStr) => {
      if (!dateStr) return '';
      const firstDate = dateStr.split(' - ')[0].trim(); // Clave: Tomar fecha inicio
      const parts = firstDate.split('/');
      if (parts.length === 3) return parts[2];
      const isoParts = firstDate.split('-');
      if (isoParts.length === 3) return isoParts[0];
      return '';
    };
    ```

### B. Vista de Estadísticas (StatsView)
*   **Nuevos Filtros:** Se han añadido dropdowns para controlar `filterMode` ('count', 'month', 'year') y `filterValue`.
*   **Procesamiento:** El `useEffect` principal que procesa `historyData` ahora debe incluir un paso intermedio que filtre los resultados por fecha antes de calcular medias y métricas.

### C. Visualización de Historial (HandicapView)
*   **Limpieza de Datos:** Implementar un filtrado en el renderizado de la lista para eliminar duplicados consecutivos.
    ```javascript
    // Filtrado visual en el JSX
    {history
      .filter((entry, index) => index === 0 || entry.handicap !== history[index - 1].handicap)
      .map((entry) => ( ... ))}
    ```

### D. Seguridad de Datos (Deploy)
*   **Protección Crítica:** Si usas scripts de despliegue FTP/SSH en el proyecto Next.js, asegúrate de **EXCLUIR** explícitamente:
    *   `tournaments.json` (Este archivo ahora se considera "vivo" en el servidor).
    *   `**/prefs_*.json` (Preferencias de usuario).
    *   `**/results_*.json` y `**/custom_tournaments_*.json`.
*   **Estrategia:** El despliegue solo debe tocar código (`.js`, `.css`, `api/`) y nunca datos JSON que residen en `public/data` o raíz, a menos que sea una restauración intencional.


## 10. Evolución Completa de Hándicap (14 de Febrero 2026)

*   **Integración de Datos de Torneos:**
    *   **Problema:** La gráfica de evolución solo mostraba los cambios introducidos manualmente, ignorando los hándicaps registrados al jugar torneos, lo que generaba lagunas de información.
    *   **Solución:** Se ha actualizado `HandicapView.jsx` para recolectar automáticamente el valor "Handicap Inicio Torneo" de todos los resultados guardados.
    *   **Fusión de Datos:** El sistema ahora combina el historial manual con el historial de torneos, ordenándolos cronológicamente.
    *   **Visualización:** En la lista detallada, las entradas provenientes de torneos se distinguen visualmente mostrando el nombre del torneo en cursiva.
    *   **Resultado:** Una gráfica de evolución continua y precisa que refleja cada punto de datos disponible en la aplicación.
    *   **Filtrado Cronológico:** Se ha implementado una regla para que la gráfica **comience** obligatoriamente desde la fecha del primer torneo con hándicap registrado, ignorando datos manuales anteriores a ese hito. Esto establece un "punto cero" claro basado en la competición real.

## 11. Estadísticas Avanzadas y Modo Móvil (15 de Febrero 2026)

*   **Seguimiento Opcional de Estadísticas:**
    *   **Personalización por Torneo:** Se han añadido checkboxes en el editor de torneos para activar/desactivar el seguimiento de **Putts** y **GIR** (Greens en Regulación).
    *   **Interfaz Limpia:** Si no se activan, las filas correspondientes no aparecen en la tarjeta de resultados, manteniendo la interfaz sencilla por defecto.
    *   **Input Flexible de GIR:** Se permite introducir valores como 'G', '+1', '+2' para mayor detalle.

*   **Modo Juego (Tarjeta Móvil):**
    *   **Nueva Experiencia de Usuario:** Se ha creado un modo "Hoyo a Hoyo" pensando en el uso en el campo desde el móvil.
    *   **Componente `MobileScorecardEditor`:** Una interfaz superpuesta con botones grandes y navegación fluida entre hoyos.
    *   **Funcionalidad:** Permite editar Golpes, Putts y GIR de forma cómoda sin luchar con la tabla pequeña.
    *   **Acceso Rápido:** Botón "📱 Modo Móvil" integrado en la vista del torneo.

*   **Estabilidad de Datos de Usuario:**
    *   **Perfil:** Se ha desactivado la sincronización en tiempo real de Firestore en `App.jsx` para evitar que datos antiguos sobrescriban los datos locales más recientes.
    *   **Backend Hándicap:** Se ha robustecido `get_handicap.php` para no devolver errores 500 si un usuario no tiene licencia configurada, mejorando la experiencia de usuarios nuevos o invitados.
✅ Scorecard Mobile: Added '-' character to numpad to allow inputting scratched holes and raya.

# Flujo del Historial de Hándicap (Handicap History Workflow)

**Última actualización**: Abril 2026

Este documento detalla cómo se extrae el historial de hándicap y torneos desde la RFEG mediante Vercel, y cómo se sincroniza de forma acumulativa e infinita en Firebase Firestore. Todos los LLMs e ingenieros que editen este sistema deben adherirse al flujo aquí descrito.

## Componentes del Sistema

### 1. Función Serverless en Vercel (`api/get_handicap.js`)
*   **Misión principal**: Evasión de bloqueos en llamadas a la RFEG descargando el PDF de resumen para el jugador (`https://api.rfeg.es/files/summaryhandicap/{ID}.pdf`).
*   **Lectura de texto**: Transforma los binarios a texto estructurado plano utilizando la librería de Node `pdf-parse`.
*   **Extracción basada en Regex Dinámico**: Dado que `pdf-parse` ocasionalmente elimina los espacios entre columnas debido al renderizado del PDF, se utiliza una expresión regular que fuerza a emparejar bloques cerrados. 
    *   *Regex actual:* `/(\d{2}\/\d{2}\/\d{4})([\s\S]*?)(\d+\.\d+)\/(\d+)\/(\d+)\s*([+-]?\d+\.\d)/g`
    *   La expresión busca específicamente una fecha, un string arbitrario (nombre del torneo), el código compuesto de valoraciones de campo `Vc/Vs/Par` unidos con `/`, un espacio opcional temporal, y la lectura estricta de un hándicap (SMH) acabado con un dígito decimal exactamente.
*   **Respuesta**: Elabora un JSON con el hándicap actual más un volcado en bruto del arreglo `history` conteniendo hasta un máximo de 20 filas oficiales.

### 2. Sincronización en Cliente (`src/services/handicap.service.js`)
*   **Desencadenante (Trigger)**: Esta sincronización se ejecuta asíncronamente en segundo plano al ejecutar `refreshHandicap()` (ej. cuando la caché diaria se ha caducado a las 08:00 AM, o si el usuario pulsa manualmente el botón de actualizar).
*   **Motor Inyector (`syncHistoricalDataToFirestore`)**: Descarga una pre-lista con todas las fechas (`date`) históricas del usuario presentes en `users/{id}/handicap_history`.
*   **Sincronización Aditiva**: Iterando encima del `history` del JSON fresco (con máximo 20 resultados), cruza las fechas. Si no consta una fecha concreta en la base temporal de Firebase, se inyecta esa nueva fila hacia la cola de un `writeBatch`.
*   **Persistencia Eterna**: Al funcionar única y exclusivamente incorporando la falta (por deltas acumulativos), esta técnica asegura que, cuando resultados antiguos acaben saliendo de los 20 más recientes de la RFEG, nunca se borrarán del ecosistema Firestore, generándose un historial ilimitado. Jamás hay operaciones destructivas.

### 3. UI React (`src/hooks/useHandicap.js`)
*   El frontend descansa totalmente de realizar lógicas. Los componentes interactivos (gráficas en `HandicapView.jsx`) dependen íntegramente de un `onSnapshot` adherido a la dirección estática `users/{uid}/handicap_history`.

## Previsión a futuro (Escalabilidad y Troubleshooting)
*   Si la página oficial de RFEG efectúa un rediseño de tipografía, debe considerarse primeramente verificar si los conectores de `/` dentro del apartado `Vc/Vs/Par` han cambiado o si los hándicaps superan más de 1 dígito decimal en el `pdf-parse` resultante, parcheando el Regex asociado.

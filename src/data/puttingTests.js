const directions = ['Subida', 'Derecha-Izquierda', 'Bajada', 'Izquierda-Derecha'];

function buildAttempts(distances) {
  return distances.flatMap((distance) => directions.map((direction) => ({
    distance,
    direction,
    putts: '',
    remainingAfterFirstPutt: '',
  })));
}

export const PUTTING_TESTS = [
  { id: 'putt-1-vuelta', name: 'Test de putt 1 vuelta', description: '18 putts iniciales que deben terminarse todos.', distances: [1.5, 2, 4, 8, 14], attempts: buildAttempts([1.5, 2, 4, 8]).concat(buildAttempts([14]).slice(0, 2)) },
  { id: 'putt-corto', name: 'Test de putt corto', description: '16 putts iniciales desde distancias cortas.', distances: [1, 1.5, 2, 3], attempts: buildAttempts([1, 1.5, 2, 3]) },
  { id: 'putt-medio', name: 'Test de putt medio', description: '12 putts iniciales desde distancias medias.', distances: [4, 5, 6], attempts: buildAttempts([4, 5, 6]) },
  { id: 'putt-largo', name: 'Test de putt largo', description: '8 putts iniciales desde 10 y 14 metros.', distances: [10, 14], attempts: buildAttempts([10, 14]) },
  { id: 'putt-completo', name: 'Test de putt completo', description: '36 putts iniciales con todas las distancias del dossier.', distances: [1, 1.5, 2, 3, 4, 5, 6, 10, 14], attempts: buildAttempts([1, 1.5, 2, 3, 4, 5, 6, 10, 14]) },
];

export const TRAINING_MOMENTS = ['Inicio de temporada', 'Control 1', 'Control 2', 'Control 3', 'Final de temporada', 'Otro'];

export function getPuttingTest(testId) {
  return PUTTING_TESTS.find((test) => test.id === testId) || PUTTING_TESTS[0];
}

export function createEmptyPuttingSession(testId = PUTTING_TESTS[0].id) {
  const test = getPuttingTest(testId);
  return {
    testId: test.id,
    date: new Date().toISOString().slice(0, 10),
    moment: TRAINING_MOMENTS[0],
    attempts: test.attempts.map((attempt) => ({ ...attempt })),
    notes: '',
  };
}

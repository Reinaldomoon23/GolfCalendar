const PUTT_DISTANCE_HOLE_COUNT = 18;

function normalizePuttDistanceHoles(puttDistances) {
  return Array.from({ length: PUTT_DISTANCE_HOLE_COUNT }, (_, holeIndex) => {
    const distances = puttDistances?.[holeIndex] ?? puttDistances?.[String(holeIndex)];
    return Array.isArray(distances) ? distances : [];
  });
}

/**
 * Firestore does not allow arrays directly nested inside other arrays.
 * Keep the React model ergonomic (one array per hole), but persist the outer
 * collection as a map keyed by hole index.
 */
export function serializeResultForFirestore(resultData) {
  if (!resultData?.scorecards) return resultData;

  const scorecards = Object.fromEntries(
    Object.entries(resultData.scorecards).map(([roundIndex, card]) => {
      if (!card?.puttDistances) return [roundIndex, card];

      const puttDistances = Object.fromEntries(
        normalizePuttDistanceHoles(card.puttDistances)
          .map((distances, holeIndex) => [String(holeIndex), distances])
      );

      return [roundIndex, { ...card, puttDistances }];
    })
  );

  return { ...resultData, scorecards };
}

export function deserializeResultFromFirestore(resultData) {
  if (!resultData?.scorecards) return resultData;

  const scorecards = Object.fromEntries(
    Object.entries(resultData.scorecards).map(([roundIndex, card]) => {
      if (!card?.puttDistances) return [roundIndex, card];
      return [roundIndex, {
        ...card,
        puttDistances: normalizePuttDistanceHoles(card.puttDistances),
      }];
    })
  );

  return { ...resultData, scorecards };
}

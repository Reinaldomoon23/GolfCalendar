const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const sum = (values = []) => values.reduce((total, value) => total + (toNumber(value) || 0), 0);

const average = (values = []) => {
  const clean = values.map(toNumber).filter((value) => value !== null);
  return clean.length ? clean.reduce((total, value) => total + value, 0) / clean.length : null;
};

const median = (values = []) => {
  const clean = values.map(toNumber).filter((value) => value !== null).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
};

const firstDate = (value) => {
  const raw = String(value || '').split(' - ')[0].trim();
  if (!raw) return null;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return new Date(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]));
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTournamentDate = (tournament = {}) => firstDate(tournament.dates || tournament.date);

const getRoundDate = (entry = {}, tournament = {}, roundIndex = 0) => {
  const explicit = entry.roundDates?.[roundIndex] || entry.dates?.[roundIndex];
  return firstDate(explicit) || getTournamentDate(tournament) || new Date(entry.updatedAt || Date.now());
};

const getCard = (entry = {}, index = 0) => entry.scorecards?.[index] || entry.scorecards?.[String(index)] || {};

const getPuttDistances = (card = {}) => {
  if (card.puttDistanceReference !== 'before_putt') return [];
  return (card.puttDistances || [])
  .flatMap((holeDistances) => Array.isArray(holeDistances) ? holeDistances : [])
  .map(toNumber)
  .filter((value) => value !== null && value >= 0);
};

const getRoundRows = (id, entry = {}, tournament = {}) => {
  const rounds = Array.isArray(entry.rounds) ? entry.rounds : [];
  return rounds.map((roundScore, index) => {
    const card = getCard(entry, index);
    const strokes = Array.isArray(card.strokes) ? card.strokes : [];
    const pars = Array.isArray(card.pars) ? card.pars : [];
    const score = toNumber(roundScore) || (sum(strokes) || null);
    if (!score) return null;
    const cardPar = pars.length >= 9 ? sum(pars) : null;
    const par = cardPar || toNumber(entry.tournamentPar) || toNumber(entry.par) || toNumber(tournament.par) || 72;
    const puttsByHole = Array.isArray(card.putts) ? card.putts : [];
    const putts = toNumber(entry.totalPutts?.[index]) || (sum(puttsByHole) || null);
    const girsByHole = Array.isArray(card.girs) ? card.girs : [];
    const girAttempts = girsByHole.filter((value) => String(value || '').trim() !== '').length;
    const girs = girsByHole.filter((value) => String(value || '').toUpperCase() === 'G').length;
    const penaltiesByHole = Array.isArray(card.penalties) ? card.penalties : [];
    const penalties = sum(penaltiesByHole) || (sum([entry.penalties?.[index]]) || 0);
    const distances = getPuttDistances(card);
    const date = getRoundDate(entry, tournament, index);

    return {
      id: `${id}-${index}`,
      eventId: String(id),
      eventName: entry.tournamentName || tournament.name || 'Vuelta',
      course: entry.tournamentCourse || tournament.course || tournament.location || '',
      date,
      sourceType: entry.recordType === 'free_round' ? 'free' : 'tournament',
      sourceLabel: entry.recordType === 'free_round' ? 'Vuelta libre' : 'Torneo',
      roundLabel: rounds.length > 1 ? `R${index + 1}` : 'Vuelta',
      score,
      par,
      vsPar: score - par,
      putts,
      girs,
      girAttempts,
      penalties,
      puttDistanceAverage: average(distances),
      puttDistanceTotal: sum(distances),
      puttDistanceCount: distances.length,
      puttsByHole,
      girsByHole,
      puttDistancesByHole: Array.from({ length: 18 }, (_, holeIndex) => (
        card.puttDistanceReference === 'before_putt' && Array.isArray(card.puttDistances?.[holeIndex])
          ? card.puttDistances[holeIndex].map(toNumber).filter((value) => value !== null && value >= 0)
          : []
      )),
      holesPlayed: strokes.filter((value) => (toNumber(value) || 0) > 0).length,
    };
  }).filter(Boolean);
};

const getTrainingRows = (sessions = []) => sessions.map((session) => {
  const attempts = Array.isArray(session.attempts) ? session.attempts : [];
  const completed = attempts.filter((attempt) => (toNumber(attempt.putts) || 0) > 0);
  const putts = completed.length ? sum(completed.map((attempt) => attempt.putts)) : null;
  const targetDistances = completed.map((attempt) => toNumber(attempt.distance)).filter((value) => value !== null);
  const remainingDistances = completed.map((attempt) => toNumber(attempt.remainingAfterFirstPutt)).filter((value) => value !== null);
  const date = firstDate(session.date) || new Date(session.updatedAt || Date.now());
  return {
    id: `training-${session.id}`,
    eventId: `training-${session.id}`,
    eventName: session.testName || session.testId || 'Test de putting',
    course: session.moment || 'Entrenamiento',
    date,
    sourceType: 'training',
    sourceLabel: 'Entrenamiento',
    roundLabel: 'Test',
    score: null,
    par: null,
    vsPar: null,
    putts,
    girs: null,
    girAttempts: 0,
    penalties: 0,
    puttDistanceAverage: average(targetDistances),
    puttDistanceTotal: sum(targetDistances),
    puttDistanceCount: targetDistances.length,
    remainingDistanceAverage: average(remainingDistances),
    completedAttempts: completed.length,
    totalAttempts: attempts.length,
  };
});

export function buildActivityRows(results = {}, tournaments = [], trainingSessions = []) {
  const tournamentMap = new Map((tournaments || []).map((tournament) => [String(tournament.id), tournament]));
  const resultRows = Object.entries(results || {}).flatMap(([id, entry]) => (
    getRoundRows(id, entry, tournamentMap.get(String(id)) || {})
  ));
  return [...resultRows, ...getTrainingRows(trainingSessions)]
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function filterActivityRows(rows = [], filters = {}) {
  const { sourceType = 'all', periodType = 'all', periodValue = '', startDate = '', endDate = '', eventCount = 'all' } = filters;
  let filtered = rows.filter((row) => {
    if (sourceType === 'golf') return row.sourceType === 'tournament' || row.sourceType === 'free';
    return sourceType === 'all' || row.sourceType === sourceType;
  });

  if (periodType === 'months' && periodValue) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - Number(periodValue));
    filtered = filtered.filter((row) => row.date >= cutoff);
  }
  if (periodType === 'dates') {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    filtered = filtered.filter((row) => (!start || row.date >= start) && (!end || row.date <= end));
  }

  if (eventCount !== 'all') {
    const eventLimit = Number(eventCount);
    const allowedEvents = [...new Set(filtered.map((row) => row.eventId))].slice(0, eventLimit);
    filtered = filtered.filter((row) => allowedEvents.includes(row.eventId));
  }
  return filtered;
}

export function summarizeActivityRows(rows = []) {
  const scored = rows.filter((row) => row.score !== null);
  const withPutts = rows.filter((row) => row.putts !== null && row.putts > 0);
  const withGir = rows.filter((row) => row.girAttempts > 0);
  const withDistances = rows.filter((row) => row.puttDistanceCount > 0);
  const events = new Set(rows.map((row) => row.eventId)).size;
  const scoreAverage = average(scored.map((row) => row.score));
  const vsParAverage = average(scored.map((row) => row.vsPar));
  const puttsAverage = average(withPutts.map((row) => row.putts));
  const girRate = withGir.length ? withGir.reduce((total, row) => total + (row.girs / row.girAttempts), 0) / withGir.length : null;
  const penaltyTotal = rows.reduce((total, row) => total + (row.penalties || 0), 0);
  const distanceAverage = withDistances.length ? average(withDistances.map((row) => row.puttDistanceAverage).filter((value) => value !== null)) : null;

  return {
    rows: rows.length,
    events,
    scoredRounds: scored.length,
    scoreAverage,
    vsParAverage,
    puttsAverage,
    girRate,
    penaltyTotal,
    distanceAverage,
    puttDistanceCount: withDistances.reduce((total, row) => total + row.puttDistanceCount, 0),
    trainingRows: rows.filter((row) => row.sourceType === 'training').length,
    tournamentRows: rows.filter((row) => row.sourceType === 'tournament').length,
    freeRows: rows.filter((row) => row.sourceType === 'free').length,
  };
}

export function buildActivityConclusions(rows = []) {
  const summary = summarizeActivityRows(rows);
  const conclusions = [];
  const scored = rows.filter((row) => row.score !== null);
  const withDistances = rows.filter((row) => row.puttDistanceCount > 0 && row.puttDistanceAverage !== null);

  if (summary.scoredRounds) {
    const best = [...scored].sort((a, b) => a.vsPar - b.vsPar)[0];
    conclusions.push(`Tu mejor vuelta del periodo es ${best.eventName} (${best.score} golpes, ${best.vsPar > 0 ? `+${best.vsPar}` : best.vsPar} respecto al par).`);
  }
  if (summary.puttsAverage !== null) {
    conclusions.push(`La media registrada es de ${summary.puttsAverage.toFixed(1)} putts por vuelta analizada.`);
  }
  if (summary.distanceAverage !== null) {
    conclusions.push(`La distancia media de los putts con distancia guardada es ${summary.distanceAverage.toFixed(2)} m (${summary.puttDistanceCount} putts medidos).`);
  } else if (summary.scoredRounds) {
    conclusions.push('Aún no hay distancias de putt suficientes para extraer una conclusión de control de velocidad.');
  }
  if (summary.girRate !== null) {
    conclusions.push(`El GIR medio de las vueltas con este dato es ${(summary.girRate * 100).toFixed(0)}%.`);
  }
  if (summary.penaltyTotal > 0) {
    conclusions.push(`Se han registrado ${summary.penaltyTotal} golpes de penalización en el periodo.`);
  } else if (summary.scoredRounds) {
    conclusions.push('No constan golpes de penalización en las vueltas analizadas.');
  }
  if (withDistances.length >= 2) {
    const recent = withDistances.slice(0, Math.ceil(withDistances.length / 2));
    const older = withDistances.slice(Math.ceil(withDistances.length / 2));
    const recentAverage = average(recent.map((row) => row.puttDistanceAverage));
    const olderAverage = average(older.map((row) => row.puttDistanceAverage));
    if (recentAverage !== null && olderAverage !== null) {
      const delta = recentAverage - olderAverage;
      conclusions.push(`La distancia media reciente es ${Math.abs(delta).toFixed(2)} m ${delta <= 0 ? 'menor' : 'mayor'} que en la parte anterior del periodo.`);
    }
  }
  return conclusions;
}

const PUTT_DISTANCE_BUCKETS = [
  { label: '0–1 m', min: 0, max: 1 },
  { label: '1–2 m', min: 1, max: 2 },
  { label: '2–3 m', min: 2, max: 3 },
  { label: '3–5 m', min: 3, max: 5 },
  { label: '5–10 m', min: 5, max: 10 },
  { label: 'Más de 10 m', min: 10, max: Infinity },
];

const getPuttOutcome = (putts) => putts >= 4 ? 'fourPlus' : `${putts}putt`;

export function buildPuttingAnalysis(rows = []) {
  const holes = rows.flatMap((row) => {
    const puttsByHole = Array.isArray(row.puttsByHole) ? row.puttsByHole : [];
    const girsByHole = Array.isArray(row.girsByHole) ? row.girsByHole : [];
    const distancesByHole = Array.isArray(row.puttDistancesByHole) ? row.puttDistancesByHole : [];
    return Array.from({ length: Math.max(puttsByHole.length, distancesByHole.length) }, (_, holeIndex) => {
      const distances = Array.isArray(distancesByHole[holeIndex]) ? distancesByHole[holeIndex] : [];
      const putts = toNumber(puttsByHole[holeIndex]) || distances.length || null;
      if (!putts || putts <= 0) return null;
      return {
        putts,
        distances,
        firstPuttDistance: distances[0] ?? null,
        secondPuttDistance: distances[1] ?? null,
        isGir: String(girsByHole[holeIndex] || '').toUpperCase() === 'G',
      };
    }).filter(Boolean);
  });

  const count = (predicate) => holes.filter(predicate).length;
  const totalPutts = sum(holes.map((hole) => hole.putts));
  const firstPuttDistances = holes.map((hole) => hole.firstPuttDistance).filter((value) => value !== null);
  const secondPuttDistances = holes.map((hole) => hole.secondPuttDistance).filter((value) => value !== null);
  const tripletHoles = holes.filter((hole) => hole.putts >= 3);
  const byOutcome = ['1putt', '2putt', '3putt', 'fourPlus'].reduce((result, key) => {
    const outcomeHoles = holes.filter((hole) => getPuttOutcome(hole.putts) === key);
    const distances = outcomeHoles.map((hole) => hole.firstPuttDistance).filter((value) => value !== null);
    result[key] = { count: outcomeHoles.length, distanceAverage: average(distances) };
    return result;
  }, {});
  const byGir = ['GIR', 'Sin GIR'].map((label) => {
    const girHoles = holes.filter((hole) => (label === 'GIR') === hole.isGir);
    return {
      label,
      holes: girHoles.length,
      averagePutts: average(girHoles.map((hole) => hole.putts)),
      triplets: count((hole) => ((label === 'GIR') === hole.isGir) && hole.putts >= 3),
    };
  });
  const measuredTripletCount = tripletHoles.filter((hole) => hole.firstPuttDistance !== null).length;
  const buckets = PUTT_DISTANCE_BUCKETS.map((bucket) => {
    const bucketTriplets = tripletHoles.filter((hole) => hole.firstPuttDistance !== null && hole.firstPuttDistance >= bucket.min && hole.firstPuttDistance < bucket.max);
    return { ...bucket, count: bucketTriplets.length, rate: measuredTripletCount ? bucketTriplets.length / measuredTripletCount : null };
  });

  return {
    holesWithData: holes.length,
    totalPutts,
    averagePuttsPerHole: average(holes.map((hole) => hole.putts)),
    onePuttCount: count((hole) => hole.putts === 1),
    twoPuttCount: count((hole) => hole.putts === 2),
    threePuttCount: count((hole) => hole.putts === 3),
    fourPlusPuttCount: count((hole) => hole.putts >= 4),
    tripletCount: tripletHoles.length,
    tripletRate: holes.length ? tripletHoles.length / holes.length : null,
    tripletDistanceMeasuredCount: measuredTripletCount,
    tripletDistanceMeasuredRate: tripletHoles.length ? measuredTripletCount / tripletHoles.length : null,
    firstPuttDistanceCount: firstPuttDistances.length,
    firstPuttDistanceAverage: average(firstPuttDistances),
    firstPuttDistanceMedian: median(firstPuttDistances),
    secondPuttDistanceAverage: average(secondPuttDistances),
    secondPuttDistanceCount: secondPuttDistances.length,
    byOutcome,
    byGir,
    tripletDistanceAverage: average(tripletHoles.map((hole) => hole.firstPuttDistance)),
    tripletDistanceCount: tripletHoles.filter((hole) => hole.firstPuttDistance !== null).length,
    tripletDistanceBuckets: buckets,
  };
}

export function buildPuttingConclusions(analysis) {
  if (!analysis?.holesWithData) return [];
  const conclusions = [];
  if (analysis.averagePuttsPerHole !== null) {
    conclusions.push(`La media es de ${analysis.averagePuttsPerHole.toFixed(2)} putts por hoyo (${analysis.holesWithData} hoyos con datos).`);
  }
  if (analysis.firstPuttDistanceAverage !== null) {
    conclusions.push(`La distancia media del primer putt es ${analysis.firstPuttDistanceAverage.toFixed(2)} m; hay ${analysis.firstPuttDistanceCount} primeros putts medidos.`);
  }
  if (analysis.tripletCount) {
    const distanceText = analysis.tripletDistanceAverage === null
      ? 'no hay distancia inicial registrada'
      : `la distancia inicial fue de ${analysis.tripletDistanceAverage.toFixed(2)} m de media (${analysis.tripletDistanceMeasuredCount} de ${analysis.tripletCount} tripateos medidos)`;
    conclusions.push(`Hay ${analysis.tripletCount} tripateo${analysis.tripletCount === 1 ? '' : 's'} (${(analysis.tripletRate * 100).toFixed(1)}% de los hoyos); en esos hoyos, ${distanceText}.`);
    const mostCommonBucket = [...analysis.tripletDistanceBuckets].sort((a, b) => b.count - a.count)[0];
    if (mostCommonBucket?.count) conclusions.push(`El tramo con más tripateos es ${mostCommonBucket.label} (${mostCommonBucket.count}).`);
  } else {
    conclusions.push('No hay tripateos en los hoyos analizados.');
  }
  return conclusions;
}

export const formatReportNumber = (value, decimals = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : '-';


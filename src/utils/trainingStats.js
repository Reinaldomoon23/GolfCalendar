function toDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getIsoWeekKey(value) {
  const date = toDate(value);
  if (!date) return '';
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-S${String(week).padStart(2, '0')}`;
}

export function getMonthKey(value) {
  return value ? String(value).slice(0, 7) : '';
}

export function getSeasonKey(value) {
  const date = toDate(value);
  if (!date) return '';
  const year = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

export function getSessionMetrics(session) {
  const attempts = (session?.attempts || []).filter((attempt) => Number(attempt.putts) > 0);
  const totalPutts = attempts.reduce((sum, attempt) => sum + Number(attempt.putts), 0);
  const withDistance = attempts.filter((attempt) => attempt.remainingAfterFirstPutt !== '' && attempt.remainingAfterFirstPutt !== null && attempt.remainingAfterFirstPutt !== undefined);
  const controlled = withDistance.filter((attempt) => Number(attempt.remainingAfterFirstPutt) <= 1).length;
  return {
    completed: attempts.length,
    totalPutts,
    averagePutts: attempts.length ? totalPutts / attempts.length : null,
    onePuttRate: attempts.length ? attempts.filter((attempt) => Number(attempt.putts) === 1).length / attempts.length : null,
    threePuttRate: attempts.length ? attempts.filter((attempt) => Number(attempt.putts) >= 3).length / attempts.length : null,
    distanceControlRate: withDistance.length ? controlled / withDistance.length : null,
  };
}

export function getSessionPeriod(session) {
  return {
    week: getIsoWeekKey(session?.date),
    month: getMonthKey(session?.date),
    season: getSeasonKey(session?.date),
  };
}

export function summarizeSessions(sessions) {
  const list = sessions || [];
  const metrics = list.map(getSessionMetrics);
  const completed = metrics.reduce((sum, item) => sum + item.completed, 0);
  const totalPutts = metrics.reduce((sum, item) => sum + item.totalPutts, 0);
  const averagePutts = completed ? totalPutts / completed : null;
  const weightedRate = (key) => {
    const numerator = metrics.reduce((sum, item) => sum + (item[key] === null ? 0 : item[key] * item.completed), 0);
    return completed ? numerator / completed : null;
  };
  return {
    tests: list.length,
    completed,
    totalPutts,
    averagePutts,
    onePuttRate: weightedRate('onePuttRate'),
    threePuttRate: weightedRate('threePuttRate'),
    distanceControlRate: weightedRate('distanceControlRate'),
  };
}

export function formatMetric(value, suffix = '') {
  return value === null || value === undefined ? '-' : `${(value * (suffix === '%' ? 100 : 1)).toFixed(suffix === '%' ? 0 : 2)}${suffix}`;
}

export function sessionsToCsv(sessions) {
  const headers = ['Fecha', 'Semana', 'Mes', 'Temporada', 'Momento', 'Test', 'Intentos completados', 'Putts totales', 'Media putts', '1 putt %', '3 putts %', 'Control <= 1m %', 'Observaciones'];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = (sessions || []).map((session) => {
    const metrics = getSessionMetrics(session);
    const periods = getSessionPeriod(session);
    return [session.date, periods.week, periods.month, periods.season, session.moment, session.testId, metrics.completed, metrics.totalPutts, metrics.averagePutts?.toFixed(2) || '', metrics.onePuttRate === null ? '' : Math.round(metrics.onePuttRate * 100), metrics.threePuttRate === null ? '' : Math.round(metrics.threePuttRate * 100), metrics.distanceControlRate === null ? '' : Math.round(metrics.distanceControlRate * 100), session.notes].map(escape).join(';');
  });
  return `\ufeff${headers.map(escape).join(';')}\n${rows.join('\n')}`;
}

export function downloadTextFile(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

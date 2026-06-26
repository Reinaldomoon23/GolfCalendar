const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const sumNumbers = (values = []) => values.reduce((total, value) => total + numberValue(value), 0);

const formatVsPar = (value) => {
  if (!Number.isFinite(value)) return '-';
  if (value === 0) return 'E';
  return value > 0 ? `+${value}` : String(value);
};

const getScoreTone = (diff) => {
  if (!Number.isFinite(diff)) return { label: '-', color: '#64748b', bg: '#f8fafc' };
  if (diff <= -2) return { label: 'Eagle+', color: '#854d0e', bg: '#fef3c7' };
  if (diff === -1) return { label: 'Birdie', color: '#075985', bg: '#e0f2fe' };
  if (diff === 0) return { label: 'Par', color: '#166534', bg: '#dcfce7' };
  if (diff === 1) return { label: 'Bogey', color: '#9a3412', bg: '#ffedd5' };
  if (diff === 2) return { label: 'Doble', color: '#991b1b', bg: '#fee2e2' };
  return { label: `+${diff}`, color: '#7f1d1d', bg: '#fecaca' };
};

const countGir = (values = []) => values.filter((value) => String(value || '').toUpperCase() === 'G').length;

const getRoundKeys = (result = {}) => {
  const keys = new Set();
  Object.keys(result.scorecards || {}).forEach((key) => keys.add(String(key)));
  (result.rounds || []).forEach((value, index) => {
    if (numberValue(value) > 0) keys.add(String(index));
  });
  return Array.from(keys).sort((a, b) => Number(a) - Number(b));
};

const buildRound = (roundKey, result = {}, tournament = {}) => {
  const index = Number(roundKey);
  const card = result.scorecards?.[roundKey] || result.scorecards?.[index] || {};
  const strokes = Array.from({ length: 18 }, (_, holeIndex) => card.strokes?.[holeIndex] ?? '');
  const pars = Array.from({ length: 18 }, (_, holeIndex) => card.pars?.[holeIndex] ?? '');
  const putts = Array.from({ length: 18 }, (_, holeIndex) => card.putts?.[holeIndex] ?? '');
  const girs = Array.from({ length: 18 }, (_, holeIndex) => card.girs?.[holeIndex] ?? '');
  const cardScore = sumNumbers(strokes);
  const manualScore = numberValue(result.rounds?.[index]);
  const score = cardScore || manualScore;
  const par = sumNumbers(pars) || Number(tournament.par) || Number(result.tournamentPar) || 72;
  const puttsTotal = sumNumbers(putts) || numberValue(result.totalPutts?.[index]);
  const holesPlayed = strokes.filter((value) => numberValue(value) > 0).length;
  const holeDiffs = strokes.map((stroke, holeIndex) => {
    const strokeValue = numberValue(stroke);
    const parValue = numberValue(pars[holeIndex]);
    return strokeValue && parValue ? strokeValue - parValue : null;
  });

  return {
    key: String(roundKey),
    index,
    label: `R${index + 1}`,
    score,
    par,
    vsPar: score ? score - par : null,
    stableford: numberValue(result.stableford?.[index]),
    putts: puttsTotal,
    girs: countGir(girs),
    girAttempts: girs.filter(Boolean).length,
    holesPlayed,
    pars,
    strokes,
    puttsByHole: putts,
    girsByHole: girs,
    birdies: holeDiffs.filter((diff) => diff !== null && diff < 0).length,
    parsCount: holeDiffs.filter((diff) => diff === 0).length,
    bogeys: holeDiffs.filter((diff) => diff === 1).length,
    doublesOrWorse: holeDiffs.filter((diff) => diff !== null && diff >= 2).length,
  };
};

export function buildTournamentReport(tournament = {}, result = {}, user = {}) {
  const roundKeys = getRoundKeys(result);
  const rounds = roundKeys.map((roundKey) => buildRound(roundKey, result, tournament));
  const holes = Array.from({ length: 18 }, (_, holeIndex) => {
    const par = rounds.find((round) => numberValue(round.pars[holeIndex]))?.pars[holeIndex] || '';
    const roundValues = rounds.map((round) => {
      const score = numberValue(round.strokes[holeIndex]);
      const parValue = numberValue(round.pars[holeIndex]);
      const diff = score && parValue ? score - parValue : null;
      return {
        label: round.label,
        score,
        diff,
        putts: numberValue(round.puttsByHole[holeIndex]) || '',
        gir: round.girsByHole[holeIndex] || '',
        tone: getScoreTone(diff),
      };
    });

    return {
      hole: holeIndex + 1,
      par,
      roundValues,
    };
  });

  const totals = rounds.reduce((acc, round) => ({
    score: acc.score + (round.score || 0),
    par: acc.par + (round.score ? round.par : 0),
    putts: acc.putts + (round.putts || 0),
    girs: acc.girs + (round.girs || 0),
    girAttempts: acc.girAttempts + (round.girAttempts || 0),
    stableford: acc.stableford + (round.stableford || 0),
    holesPlayed: acc.holesPlayed + (round.holesPlayed || 0),
  }), { score: 0, par: 0, putts: 0, girs: 0, girAttempts: 0, stableford: 0, holesPlayed: 0 });

  const validScores = rounds.map((round) => round.score).filter(Boolean);
  const bestRound = rounds.filter((round) => round.score).sort((a, b) => a.score - b.score)[0] || null;
  const worstRound = rounds.filter((round) => round.score).sort((a, b) => b.score - a.score)[0] || null;

  return {
    user,
    tournament,
    result,
    rounds,
    holes,
    totals: {
      ...totals,
      vsPar: totals.score && totals.par ? totals.score - totals.par : null,
      average: validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '-',
      bestRound,
      worstRound,
    },
  };
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const photoUrlForUser = (user = {}) => {
  const name = user.full_name || user.fullName || user.username || 'Golf';
  return user.photo_url || user.photoUrl || user.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=fff&size=256`;
};

export function printTournamentReport(report) {
  const user = report.user || {};
  const tournament = report.tournament || {};
  const playerName = user.full_name || user.fullName || user.username || 'Jugadora';
  const photoUrl = photoUrlForUser(user);
  const rows = report.holes.map((hole) => `
    <tr>
      <td>${hole.hole}</td>
      <td>${escapeHtml(hole.par || '-')}</td>
      ${report.rounds.map((round, index) => {
        const value = hole.roundValues[index];
        return `<td><span class="score-pill" style="background:${value.tone.bg};color:${value.tone.color}">${value.score || '-'}</span></td>`;
      }).join('')}
    </tr>
  `).join('');
  const roundHeaders = report.rounds.map((round) => `<th>${escapeHtml(round.label)}</th>`).join('');
  const roundCards = report.rounds.map((round) => `
    <div class="round-card">
      <div class="round-label">${escapeHtml(round.label)}</div>
      <div class="round-score">${round.score || '-'}</div>
      <div class="round-meta">${formatVsPar(round.vsPar)} vs par</div>
      <div class="round-grid">
        <span>Putts</span><strong>${round.putts || '-'}</strong>
        <span>GIR</span><strong>${round.girAttempts ? `${round.girs}/${round.girAttempts}` : '-'}</strong>
        <span>Birdies</span><strong>${round.birdies || '-'}</strong>
        <span>Pares</span><strong>${round.parsCount || '-'}</strong>
      </div>
    </div>
  `).join('');

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Informe ${escapeHtml(tournament.name || '')}</title>
      <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #102018; background: #f7f4ef; }
        .page { min-height: 100vh; background: #fbfaf7; padding: 30px; }
        .hero { border-radius: 24px; overflow: hidden; background: linear-gradient(135deg, #071814 0%, #123d31 52%, #c9a45d 100%); color: white; padding: 28px; display: grid; grid-template-columns: 96px 1fr auto; gap: 22px; align-items: center; }
        .avatar { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(255,255,255,.8); box-shadow: 0 18px 48px rgba(0,0,0,.28); }
        .eyebrow { letter-spacing: .22em; text-transform: uppercase; font-size: 11px; color: #f3d88a; font-weight: 800; }
        h1 { margin: 6px 0 4px; font-size: 28px; line-height: 1.1; }
        .subtitle { color: rgba(255,255,255,.78); font-size: 13px; }
        .hero-score { text-align: right; }
        .hero-score strong { display: block; font-size: 40px; line-height: 1; }
        .hero-score span { color: #f3d88a; font-weight: 800; }
        .section { margin-top: 18px; padding: 20px; border: 1px solid #e7dfd0; border-radius: 20px; background: white; box-shadow: 0 18px 50px rgba(16,32,24,.08); break-inside: avoid; }
        .section h2 { margin: 0 0 14px; font-size: 16px; letter-spacing: .08em; text-transform: uppercase; color: #1f3d34; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; }
        .kpi { padding: 14px; border-radius: 16px; background: #f8faf8; border: 1px solid #e5eee8; }
        .kpi span { display: block; color: #64746d; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; font-weight: 800; }
        .kpi strong { display: block; color: #102018; font-size: 24px; margin-top: 4px; }
        .rounds { display: grid; grid-template-columns: repeat(${Math.max(report.rounds.length, 1)}, 1fr); gap: 12px; }
        .round-card { padding: 16px; border-radius: 18px; background: #0f241e; color: white; }
        .round-label { color: #f3d88a; font-weight: 900; letter-spacing: .12em; }
        .round-score { font-size: 38px; line-height: 1; margin-top: 10px; font-weight: 900; }
        .round-meta { color: rgba(255,255,255,.74); font-weight: 800; margin-top: 4px; }
        .round-grid { display: grid; grid-template-columns: 1fr auto; gap: 7px; margin-top: 14px; font-size: 12px; }
        .round-grid span { color: rgba(255,255,255,.65); }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #102018; color: white; padding: 10px 8px; text-align: center; }
        td { border-bottom: 1px solid #edf1ee; padding: 8px; text-align: center; }
        td:first-child, td:nth-child(2) { font-weight: 900; color: #102018; }
        .score-pill { display: inline-flex; min-width: 28px; height: 28px; align-items: center; justify-content: center; border-radius: 999px; font-weight: 900; }
        .footer { margin-top: 18px; color: #748078; font-size: 11px; text-align: center; }
        @media print { .page { padding: 0; } .section { box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="hero">
          <img class="avatar" src="${escapeHtml(photoUrl)}" />
          <div>
            <div class="eyebrow">Informe premium RoundTracker</div>
            <h1>${escapeHtml(playerName)}</h1>
            <div class="subtitle">${escapeHtml(tournament.name || '')}<br>${escapeHtml(tournament.course || tournament.location || '')} · ${escapeHtml(tournament.dates || '')}</div>
          </div>
          <div class="hero-score">
            <strong>${report.totals.score || '-'}</strong>
            <span>${formatVsPar(report.totals.vsPar)} vs par</span>
          </div>
        </div>
        <div class="kpis">
          <div class="kpi"><span>Media</span><strong>${report.totals.average}</strong></div>
          <div class="kpi"><span>Rondas</span><strong>${report.rounds.length}</strong></div>
          <div class="kpi"><span>Putts</span><strong>${report.totals.putts || '-'}</strong></div>
          <div class="kpi"><span>GIR</span><strong>${report.totals.girAttempts ? `${report.totals.girs}/${report.totals.girAttempts}` : '-'}</strong></div>
        </div>
        <div class="section">
          <h2>Comparativa por rondas</h2>
          <div class="rounds">${roundCards || '<p>Sin rondas registradas.</p>'}</div>
        </div>
        <div class="section">
          <h2>Analisis hoyo a hoyo</h2>
          <table>
            <thead><tr><th>Hoyo</th><th>Par</th>${roundHeaders}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="footer">Generado con RoundTracker · ${new Date().toLocaleDateString('es-ES')}</div>
      </div>
      <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 350); });</script>
    </body>
  </html>`;

  const printWindow = window.open('', '_blank', 'width=1100,height=900');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}

export { formatVsPar, getScoreTone };

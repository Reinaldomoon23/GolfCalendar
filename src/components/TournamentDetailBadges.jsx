const ORGANIZER_COLORS = {
  RFEG: '#DC2626',
  FCG: '#D97706',
  CAMIRAL: '#059669',
  'JUNIOR BABY CUP': '#0EA5E9',
  LEGACY: '#4F46E5',
  CLUB: '#475569',
};

const FALLBACK_COLORS = ['#0D9488', '#DB2777', '#7C3AED', '#0891B2', '#65A30D', '#C026D3'];

function getOrganizerColor(organizer) {
  if (ORGANIZER_COLORS[organizer]) return ORGANIZER_COLORS[organizer];

  let hash = 0;
  const value = organizer || 'DEFAULT';
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function parseTournamentDateRange(dateText) {
  if (!dateText) return { start: 0, end: 0 };
  const parts = dateText.split(' - ');
  const parse = (value) => {
    const [day, month, year] = value.split('/').map(Number);
    return new Date(year, month - 1, day).getTime();
  };
  const start = parse(parts[0]);
  return { start, end: parts.length > 1 ? parse(parts[1]) : start };
}

export default function TournamentDetailBadges({ tournament, isPast }) {
  const { start, end } = parseTournamentDateRange(tournament.dates);
  const todayTime = new Date().setHours(0, 0, 0, 0);
  const inProgress = start <= todayTime && todayTime <= end;
  const isFinished = end < todayTime;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
      <div>
        <span className="badge" style={{ backgroundColor: getOrganizerColor(tournament.organizer), color: 'white', marginBottom: '1rem', display: 'inline-block' }}>
          {tournament.organizer}
        </span>
        {tournament.grand_prix && (
          <span className="badge" style={{ backgroundColor: 'var(--color-grand-prix)', color: 'white', marginLeft: '0.5rem' }}>
            GRAND PRIX
          </span>
        )}
        {tournament.valedera && (
          <span className="badge" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary)', marginLeft: '0.5rem' }}>
            VALEDERA
          </span>
        )}
        {tournament.sace && (
          <span className="badge" style={{ backgroundColor: '#2563eb', color: 'white', marginLeft: '0.5rem' }}>
            SACE
          </span>
        )}
        {(tournament.merit || tournament.type === 'merit') && (
          <span className="badge" style={{ backgroundColor: '#B58B80', color: 'white', marginLeft: '0.5rem' }}>
            ORDEN MÉRITO
          </span>
        )}
        {tournament.wagr && (
          <span className="badge" style={{ backgroundColor: '#1e293b', color: 'white', marginLeft: '0.5rem' }}>
            WAGR
          </span>
        )}
        {isPast(tournament.dates) && (
          <span className="badge" style={{ backgroundColor: '#64748b', color: 'white', marginLeft: '0.5rem' }}>
            FINALIZADO
          </span>
        )}
        {!isFinished && inProgress && (
          <span className="badge" style={{ backgroundColor: '#22c55e', color: 'white', marginLeft: '0.5rem', animation: 'pulse 2s infinite' }}>
            EN JUEGO
          </span>
        )}
      </div>
      {tournament.conflict && (
        <span className="badge" style={{ backgroundColor: 'var(--color-conflict)', color: 'white' }}>
          CONFLICTO DE FECHAS
        </span>
      )}
    </div>
  );
}

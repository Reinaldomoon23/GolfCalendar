import { Download, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import ProfileImage from './ProfileImage';
import { buildTournamentReport, formatVsPar, getScoreTone, printTournamentReport } from '../utils/tournamentReport';

const cardStyle = {
  background: 'white',
  border: '1px solid #e7dfd0',
  borderRadius: '18px',
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
};

const statLabel = {
  display: 'block',
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#64748b',
  fontWeight: 900,
};

const statValue = {
  display: 'block',
  fontSize: '1.55rem',
  lineHeight: 1.1,
  marginTop: '4px',
  color: '#102018',
  fontWeight: 900,
};

function roundTrend(current, previous) {
  if (!current?.score || !previous?.score) return null;
  const delta = current.score - previous.score;
  if (delta === 0) return { label: 'igual', color: '#64748b', icon: null };
  if (delta < 0) return { label: `${Math.abs(delta)} mejor`, color: '#16a34a', icon: TrendingDown };
  return { label: `${delta} peor`, color: '#dc2626', icon: TrendingUp };
}

export default function TournamentReport({ tournament, result, user }) {
  const report = buildTournamentReport(tournament, result, user);
  const playerName = user?.full_name || user?.fullName || user?.username || 'Jugadora';
  const photoPath = user?.photo_url || user?.photoUrl || user?.photo || '';
  const hasRounds = report.rounds.length > 0;

  const handleGeneratePdf = () => {
    const opened = printTournamentReport(report);
    if (!opened) {
      console.warn('[report] Could not open print window. Browser may have blocked popups.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div style={{
        ...cardStyle,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #081c18 0%, #113f34 54%, #c9a45d 100%)',
        color: 'white',
        padding: '22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
            <ProfileImage
              photoPath={photoPath}
              displayName={playerName}
              alt={playerName}
              style={{
                width: '78px',
                height: '78px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid rgba(255,255,255,0.8)',
                boxShadow: '0 14px 34px rgba(0,0,0,0.25)',
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: '#f8d67b',
                fontSize: '0.72rem',
                fontWeight: 900,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}>
                Informe premium
              </div>
              <h2 style={{ margin: '5px 0 4px', fontSize: '1.45rem', lineHeight: 1.15 }}>{playerName}</h2>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.88rem', fontWeight: 700 }}>
                {tournament?.name || 'Torneo'} · {tournament?.course || tournament?.location || 'Campo'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGeneratePdf}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.14)',
              color: 'white',
              borderRadius: '999px',
              padding: '10px 16px',
              fontWeight: 900,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Download size={16} />
            Generar PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
        {[
          ['Total', report.totals.score || '-'],
          ['Vs par', formatVsPar(report.totals.vsPar)],
          ['Media', report.totals.average],
          ['Rondas', report.rounds.length],
          ['Putts', report.totals.putts || '-'],
          ['GIR', report.totals.girAttempts ? `${report.totals.girs}/${report.totals.girAttempts}` : '-'],
          ...(report.totals.hasStableford ? [['Stableford', report.totals.stableford]] : []),
        ].map(([label, value]) => (
          <div key={label} style={{ ...cardStyle, padding: '14px' }}>
            <span style={statLabel}>{label}</span>
            <strong style={statValue}>{value}</strong>
          </div>
        ))}
      </div>

      {!hasRounds ? (
        <div style={{ ...cardStyle, padding: '32px', textAlign: 'center', color: '#64748b' }}>
          <FileText size={34} style={{ marginBottom: '10px' }} />
          <div style={{ fontWeight: 900 }}>Todavía no hay resultados suficientes para generar informe.</div>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, padding: '18px' }}>
            <h3 style={{ margin: '0 0 14px', color: '#102018', fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Comparativa por rondas
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              {report.rounds.map((round, index) => {
                const trend = roundTrend(round, report.rounds[index - 1]);
                const TrendIcon = trend?.icon;
                return (
                  <div key={round.key} style={{
                    background: '#102018',
                    color: 'white',
                    borderRadius: '16px',
                    padding: '16px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f8d67b', fontWeight: 900 }}>
                      <span>{round.label}</span>
                      <span>{formatVsPar(round.vsPar)}</span>
                    </div>
                    <div style={{ fontSize: '2.45rem', fontWeight: 900, marginTop: '8px', lineHeight: 1 }}>{round.score || '-'}</div>
                    {trend && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: trend.color, fontWeight: 900, marginTop: '8px' }}>
                        {TrendIcon && <TrendIcon size={14} />}
                        {trend.label} que {report.rounds[index - 1]?.label}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px', marginTop: '14px', color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem' }}>
                      <span>Putts</span><strong>{round.putts || '-'}</strong>
                      <span>GIR</span><strong>{round.girAttempts ? `${round.girs}/${round.girAttempts}` : '-'}</strong>
                      {report.totals.hasStableford && Number(round.stableford) > 0 && (
                        <>
                          <span>Stableford</span><strong>{round.stableford}</strong>
                        </>
                      )}
                      <span>Birdies o mejor</span><strong>{round.birdies || '-'}</strong>
                      <span>Pares</span><strong>{round.parsCount || '-'}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...cardStyle, padding: '18px', overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 14px', color: '#102018', fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Análisis hoyo a hoyo
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${Math.max(560, 240 + report.rounds.length * 82)}px` }}>
              <thead>
                <tr>
                  <th style={thStyle}>Hoyo</th>
                  <th style={thStyle}>Par</th>
                  {report.rounds.map((round) => <th key={round.key} style={thStyle}>{round.label}</th>)}
                  <th style={thStyle}>Media</th>
                </tr>
              </thead>
              <tbody>
                {report.holes.map((hole) => (
                  <tr key={hole.hole}>
                    <td style={tdStrong}>{hole.hole}</td>
                    <td style={tdStrong}>{hole.par || '-'}</td>
                    {hole.roundValues.map((value, index) => {
                      const tone = getScoreTone(value.diff);
                      return (
                        <td key={`${hole.hole}-${index}`} style={tdStyle}>
                          <span style={{
                            display: 'inline-flex',
                            minWidth: '30px',
                            height: '30px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '999px',
                            background: tone.bg,
                            color: tone.color,
                            fontWeight: 900,
                          }}>
                            {value.score || '-'}
                          </span>
                        </td>
                      );
                    })}
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex',
                        minWidth: '38px',
                        height: '30px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '999px',
                        background: hole.averageTone.bg,
                        color: hole.averageTone.color,
                        fontWeight: 900,
                      }}>
                        {Number.isFinite(hole.averageScore) ? hole.averageScore.toFixed(1) : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 8px',
  background: '#102018',
  color: 'white',
  fontSize: '0.75rem',
  textAlign: 'center',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const tdStyle = {
  padding: '9px 8px',
  borderBottom: '1px solid #edf1ee',
  textAlign: 'center',
};

const tdStrong = {
  ...tdStyle,
  color: '#102018',
  fontWeight: 900,
};

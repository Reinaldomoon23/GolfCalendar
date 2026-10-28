import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FileText, Plus, Printer, Save, X } from 'lucide-react';
import { subscribeToTrainingTests } from '../services/trainingTests.service';
import { saveResult } from '../services/results.service';
import {
  buildActivityConclusions,
  buildActivityRows,
  buildPuttingAnalysis,
  buildPuttingConclusions,
  filterActivityRows,
  formatReportNumber,
  summarizeActivityRows,
} from '../utils/reportAnalytics';

const cardStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1rem', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)' };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.65rem', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg)', color: 'inherit' };
const buttonStyle = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.65rem 0.9rem', background: 'var(--color-bg)', color: 'inherit', fontWeight: 800, cursor: 'pointer' };

const formatDate = (date) => date instanceof Date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-ES') : '-';
const formatVsPar = (value) => value === null || value === undefined ? '-' : value === 0 ? 'E' : value > 0 ? `+${value}` : String(value);

function downloadCsv(rows) {
  const header = 'Fecha,Tipo,Actividad,Campo,Vuelta,Golpes,Par,VsPar,Putts,Distancia media putt,GIR,Penalizaciones';
  const body = rows.map((row) => [
    formatDate(row.date), row.sourceLabel, row.eventName, row.course, row.roundLabel, row.score ?? '', row.par ?? '', row.vsPar ?? '', row.putts ?? '', row.puttDistanceAverage ?? '', row.girAttempts ? `${row.girs}/${row.girAttempts}` : '', row.penalties || 0,
  ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `informe-golf-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function FreeRoundForm({ user, onSaved, onCancel }) {
  const [form, setForm] = useState({ name: 'Vuelta libre', date: new Date().toISOString().slice(0, 10), course: '', par: '72', score: '', putts: '', penalties: '0' });
  const [status, setStatus] = useState('');
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    const score = Number(form.score);
    if (!form.name.trim() || !form.date || !Number.isFinite(score) || score <= 0) {
      setStatus('Indica nombre, fecha y golpes totales.');
      return;
    }
    const id = `free-round-${form.date}-${Date.now()}`;
    const result = {
      recordType: 'free_round',
      tournamentName: form.name.trim(),
      tournamentCourse: form.course.trim(),
      tournamentDates: form.date,
      tournamentPar: Number(form.par) || 72,
      rounds: [score],
      totalPutts: [Number(form.putts) > 0 ? Number(form.putts) : ''],
      penalties: [Number(form.penalties) || 0],
      updatedAt: new Date().toISOString(),
    };
    try {
      setStatus('Guardando...');
      await saveResult(user, id, result);
      setStatus('Vuelta guardada.');
      onSaved?.();
    } catch (error) {
      console.error('[reports] Free round save failed:', error);
      setStatus('No se pudo guardar la vuelta.');
    }
  };

  return <div style={{ ...cardStyle, marginBottom: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.8rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Añadir vuelta fuera de torneo</h2>
      <button type="button" onClick={onCancel} style={{ ...buttonStyle, padding: '0.45rem' }} aria-label="Cerrar"><X size={16} /></button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem' }}>
      <label>Nombre<input value={form.name} onChange={(event) => update('name', event.target.value)} style={inputStyle} /></label>
      <label>Fecha<input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} style={inputStyle} /></label>
      <label>Campo<input value={form.course} onChange={(event) => update('course', event.target.value)} style={inputStyle} /></label>
      <label>Par<input type="number" min="1" value={form.par} onChange={(event) => update('par', event.target.value)} style={inputStyle} /></label>
      <label>Golpes<input type="number" min="1" value={form.score} onChange={(event) => update('score', event.target.value)} style={inputStyle} /></label>
      <label>Putts totales<input type="number" min="0" value={form.putts} onChange={(event) => update('putts', event.target.value)} style={inputStyle} /></label>
      <label>Penalizaciones<input type="number" min="0" value={form.penalties} onChange={(event) => update('penalties', event.target.value)} style={inputStyle} /></label>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
      <button type="button" onClick={handleSave} style={{ ...buttonStyle, background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}><Save size={16} /> Guardar vuelta</button>
      <span style={{ color: status.startsWith('No') ? '#b91c1c' : 'var(--color-text-muted)' }}>{status}</span>
    </div>
  </div>;
}

export default function ReportsView({ user, results = {}, tournaments = [] }) {
  const [trainingSessions, setTrainingSessions] = useState([]);
  const [sourceType, setSourceType] = useState('golf');
  const [periodType, setPeriodType] = useState('all');
  const [periodValue, setPeriodValue] = useState('6');
  const [eventCount, setEventCount] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFreeRound, setShowFreeRound] = useState(false);

  useEffect(() => subscribeToTrainingTests(user, setTrainingSessions), [user]);

  const allRows = useMemo(() => buildActivityRows(results, tournaments, trainingSessions), [results, tournaments, trainingSessions]);
  const rows = useMemo(() => filterActivityRows(allRows, { sourceType, periodType, periodValue, startDate, endDate, eventCount }), [allRows, sourceType, periodType, periodValue, startDate, endDate, eventCount]);
  const summary = useMemo(() => summarizeActivityRows(rows), [rows]);
  const conclusions = useMemo(() => buildActivityConclusions(rows), [rows]);
  const putting = useMemo(() => buildPuttingAnalysis(rows), [rows]);
  const puttingConclusions = useMemo(() => buildPuttingConclusions(putting), [putting]);

  if (!user) return <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}><div style={cardStyle}>Inicia sesión para consultar tus informes.</div></div>;

  return <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem', color: 'var(--color-text)' }}>
    <div style={{ ...cardStyle, marginBottom: '1rem', background: 'linear-gradient(135deg, #0f2d25, #1e6048)', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div><div style={{ opacity: 0.75, fontSize: '0.75rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>Análisis de rendimiento</div><h1 style={{ margin: '0.25rem 0', fontSize: '1.6rem' }}>Informes de golf</h1><p style={{ margin: 0, opacity: 0.8 }}>Torneos, entrenamientos y vueltas libres en una misma lectura.</p></div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><button type="button" onClick={() => setShowFreeRound(true)} style={{ ...buttonStyle, background: '#f8d67b', color: '#102018', borderColor: '#f8d67b' }}><Plus size={16} /> Añadir vuelta libre</button><button type="button" onClick={() => downloadCsv(rows)} style={{ ...buttonStyle, background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}><Download size={16} /> CSV</button><button type="button" onClick={() => window.print()} style={{ ...buttonStyle, background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}><Printer size={16} /> Imprimir</button></div>
      </div>
    </div>

    {showFreeRound && <FreeRoundForm user={user} onSaved={() => setShowFreeRound(false)} onCancel={() => setShowFreeRound(false)} />}

    <div style={{ ...cardStyle, marginBottom: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '0.7rem' }}>
        <label>Origen<select value={sourceType} onChange={(event) => setSourceType(event.target.value)} style={inputStyle}><option value="golf">Torneos y vueltas libres</option><option value="tournament">Solo torneos</option><option value="free">Solo vueltas libres</option><option value="training">Solo entrenamientos</option></select></label>
        <label>Periodo<select value={periodType} onChange={(event) => setPeriodType(event.target.value)} style={inputStyle}><option value="all">Todo el historial</option><option value="months">Últimos meses</option><option value="dates">Entre fechas</option></select></label>
        {periodType === 'months' && <label>Meses<select value={periodValue} onChange={(event) => setPeriodValue(event.target.value)} style={inputStyle}><option value="1">1 mes</option><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option><option value="24">24 meses</option></select></label>}
        {periodType === 'dates' && <><label>Desde<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} style={inputStyle} /></label><label>Hasta<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} style={inputStyle} /></label></>}
        <label>Número de eventos<select value={eventCount} onChange={(event) => setEventCount(event.target.value)} style={inputStyle}><option value="all">Todos</option><option value="5">Últimos 5</option><option value="10">Últimos 10</option><option value="20">Últimos 20</option></select></label>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.7rem', marginBottom: '1rem' }}>
      {[['Eventos', summary.events], ['Vueltas', summary.rows], ['Media golpes', formatReportNumber(summary.scoreAverage)], ['Vs par', summary.vsParAverage === null ? '-' : formatVsPar(Number(summary.vsParAverage.toFixed(1)))], ['Media putts', formatReportNumber(summary.puttsAverage)], ['GIR medio', summary.girRate === null ? '-' : `${(summary.girRate * 100).toFixed(0)}%`], ['Distancia putt', summary.distanceAverage === null ? '-' : `${summary.distanceAverage.toFixed(2)} m`], ['Penalizaciones', summary.penaltyTotal]].map(([label, value]) => <div key={label} style={{ ...cardStyle, padding: '0.8rem' }}><div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div><strong style={{ display: 'block', fontSize: '1.35rem', marginTop: '0.25rem' }}>{value}</strong></div>)}
    </div>

    <div style={{ ...cardStyle, marginBottom: '1rem' }}><h2 style={{ margin: '0 0 0.8rem', fontSize: '1.1rem' }}><BarChart3 size={18} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Conclusiones</h2>{conclusions.length ? <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.55rem' }}>{conclusions.map((conclusion) => <li key={conclusion}>{conclusion}</li>)}</ul> : <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>No hay suficientes datos para extraer conclusiones todavía.</p>}</div>

    <div style={{ ...cardStyle, marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}><BarChart3 size={18} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Análisis de putting</h2>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>{putting.holesWithData ? `${putting.holesWithData} hoyos con datos de putts` : 'Sin datos por hoyo'}</span>
      </div>
      {putting.holesWithData ? <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.7rem', margin: '1rem 0' }}>
          {[
            ['Putts / hoyo', formatReportNumber(putting.averagePuttsPerHole, 2)],
            ['Primer putt medio', putting.firstPuttDistanceAverage === null ? '-' : `${putting.firstPuttDistanceAverage.toFixed(2)} m`],
            ['Tripateos', putting.tripletCount],
            ['% tripateos', putting.tripletRate === null ? '-' : `${(putting.tripletRate * 100).toFixed(1)}%`],
            ['2.º putt medio', putting.secondPuttDistanceAverage === null ? '-' : `${putting.secondPuttDistanceAverage.toFixed(2)} m`],
          ].map(([label, value]) => <div key={label} style={{ ...cardStyle, padding: '0.75rem', background: 'var(--color-bg)' }}><div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>{label}</div><strong style={{ display: 'block', fontSize: '1.3rem', marginTop: '0.25rem' }}>{value}</strong></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <div style={{ overflowX: 'auto' }}><h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Resultado por hoyo</h3><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>{['Resultado', 'Hoyo', '%'].map((header) => <th key={header} style={{ padding: '0.45rem' }}>{header}</th>)}</tr></thead><tbody>{[['1 putt', putting.onePuttCount], ['2 putts', putting.twoPuttCount], ['3 putts', putting.threePuttCount], ['4+ putts', putting.fourPlusPuttCount]].map(([label, count]) => <tr key={label} style={{ borderBottom: '1px solid var(--color-border)' }}><td style={{ padding: '0.45rem' }}>{label}</td><td style={{ padding: '0.45rem' }}>{count}</td><td style={{ padding: '0.45rem' }}>{((count / putting.holesWithData) * 100).toFixed(1)}%</td></tr>)}</tbody></table></div>
          <div style={{ overflowX: 'auto' }}><h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Tripateos según primer putt</h3><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>{['Distancia', 'Tripateos', '%'].map((header) => <th key={header} style={{ padding: '0.45rem' }}>{header}</th>)}</tr></thead><tbody>{putting.tripletDistanceBuckets.map((bucket) => <tr key={bucket.label} style={{ borderBottom: '1px solid var(--color-border)' }}><td style={{ padding: '0.45rem' }}>{bucket.label}</td><td style={{ padding: '0.45rem' }}>{bucket.count}</td><td style={{ padding: '0.45rem' }}>{bucket.rate === null ? '-' : `${(bucket.rate * 100).toFixed(1)}%`}</td></tr>)}</tbody></table></div>
          <div style={{ overflowX: 'auto' }}><h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>GIR frente a no GIR</h3><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>{['Situación', 'Hoyos', 'Putts/hoyo', 'Tripateos'].map((header) => <th key={header} style={{ padding: '0.45rem' }}>{header}</th>)}</tr></thead><tbody>{putting.byGir.map((group) => <tr key={group.label} style={{ borderBottom: '1px solid var(--color-border)' }}><td style={{ padding: '0.45rem' }}>{group.label}</td><td style={{ padding: '0.45rem' }}>{group.holes}</td><td style={{ padding: '0.45rem' }}>{formatReportNumber(group.averagePutts, 2)}</td><td style={{ padding: '0.45rem' }}>{group.triplets}</td></tr>)}</tbody></table></div>
        </div>
        <ul style={{ margin: '1rem 0 0', paddingLeft: '1.2rem', display: 'grid', gap: '0.4rem' }}>{puttingConclusions.map((conclusion) => <li key={conclusion}>{conclusion}</li>)}</ul>
        <p style={{ margin: '0.8rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>Las medias de distancia solo usan putts con distancia guardada; no se estiman datos que no estén en la tarjeta.</p>
      </> : <p style={{ margin: '1rem 0 0', color: 'var(--color-text-muted)' }}>Para mostrar este análisis hay que guardar los putts por hoyo. Las vueltas libres antiguas con solo putts totales no permiten calcular primer putt ni tripateos.</p>}
    </div>

    <div style={{ ...cardStyle, overflowX: 'auto' }}><h2 style={{ margin: '0 0 0.8rem', fontSize: '1.1rem' }}><FileText size={18} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Detalle de actividades</h2>{rows.length ? <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}><thead><tr style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>{['Fecha', 'Tipo', 'Actividad', 'Golpes', 'Vs par', 'Putts', 'Dist. putt', 'GIR', 'Penal.'].map((header) => <th key={header} style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)' }}><td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>{formatDate(row.date)}</td><td style={{ padding: '0.6rem' }}>{row.sourceLabel}</td><td style={{ padding: '0.6rem' }}><strong>{row.eventName}</strong><div style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>{row.course} · {row.roundLabel}</div></td><td style={{ padding: '0.6rem' }}>{row.score ?? '-'}</td><td style={{ padding: '0.6rem' }}>{formatVsPar(row.vsPar)}</td><td style={{ padding: '0.6rem' }}>{row.putts ?? '-'}</td><td style={{ padding: '0.6rem' }}>{row.puttDistanceAverage === null ? '-' : `${row.puttDistanceAverage.toFixed(2)} m`}</td><td style={{ padding: '0.6rem' }}>{row.girAttempts ? `${row.girs}/${row.girAttempts}` : '-'}</td><td style={{ padding: '0.6rem' }}>{row.penalties || 0}</td></tr>)}</tbody></table> : <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>No hay actividades para estos filtros.</p>}</div>
  </div>;
}


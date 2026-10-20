import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, Download, Printer, Trash2 } from 'lucide-react';
import { createEmptyPuttingSession, getPuttingTest, PUTTING_TESTS, TRAINING_MOMENTS } from '../data/puttingTests';
import { deleteTrainingTest, saveTrainingTest, subscribeToTrainingTests } from '../services/trainingTests.service';
import { downloadTextFile, formatMetric, getSessionMetrics, getSessionPeriod, sessionsToCsv, summarizeSessions } from '../utils/trainingStats';

const pageStyle = { maxWidth: '1100px', margin: '0 auto', padding: '1rem', color: 'var(--color-text)' };
const cardStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1rem', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)' };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.65rem', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg)', color: 'inherit' };

function makeSessionId() {
  return `putting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function TrainingTestsView({ user }) {
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(() => ({ ...createEmptyPuttingSession(), id: makeSessionId() }));
  const [status, setStatus] = useState('');
  const [periodType, setPeriodType] = useState('all');
  const [periodValue, setPeriodValue] = useState('');
  const [testFilter, setTestFilter] = useState('all');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches);
  const selectedTest = useMemo(() => getPuttingTest(session.testId), [session.testId]);
  const metrics = useMemo(() => getSessionMetrics(session), [session]);
  const filteredSessions = useMemo(() => sessions.filter((saved) => {
    const periods = getSessionPeriod(saved);
    return (testFilter === 'all' || saved.testId === testFilter) && (!periodValue || periods[periodType] === periodValue);
  }), [periodType, periodValue, sessions, testFilter]);
  const filteredSummary = useMemo(() => summarizeSessions(filteredSessions), [filteredSessions]);
  const availablePeriods = useMemo(() => [...new Set(sessions.map((saved) => getSessionPeriod(saved)[periodType]).filter(Boolean))].sort().reverse(), [periodType, sessions]);

  useEffect(() => subscribeToTrainingTests(user, setSessions), [user]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 700px)');
    const handleChange = (event) => setIsMobile(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const updateAttempt = (index, field, value) => {
    setSession((current) => ({
      ...current,
      attempts: current.attempts.map((attempt, attemptIndex) => attemptIndex === index ? { ...attempt, [field]: value } : attempt),
    }));
  };

  const changeTest = (testId) => {
    setSession({ ...createEmptyPuttingSession(testId), id: makeSessionId() });
    setStatus('');
  };

  const handleSave = async () => {
    try {
      setStatus('Guardando...');
      await saveTrainingTest(user, session);
      setStatus('Test guardado');
    } catch (error) {
      console.error('[training-tests] Save failed:', error);
      setStatus('No se pudo guardar el test');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTrainingTest(user, id);
      setStatus('Test eliminado');
    } catch (error) {
      console.error('[training-tests] Delete failed:', error);
      setStatus('No se pudo eliminar el test');
    }
  };

  const clearFilters = () => setPeriodValue('');
  const exportCsv = () => downloadTextFile(`tests-putting-${new Date().toISOString().slice(0, 10)}.csv`, sessionsToCsv(filteredSessions));
  const printReport = () => window.print();

  if (!user) return <div style={pageStyle}><div style={cardStyle}>Inicia sesión para registrar tests de entrenamiento.</div></div>;

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <ClipboardList size={24} color="var(--color-primary)" />
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Tests de putting</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Registra los tests del dossier y sigue la evolución por distancia y pendiente.</p>
      </div>

      <div style={{ ...cardStyle, marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <label>Test<select value={session.testId} onChange={(event) => changeTest(event.target.value)} style={inputStyle}>{PUTTING_TESTS.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}</select></label>
          <label>Fecha<input type="date" value={session.date} onChange={(event) => setSession((current) => ({ ...current, date: event.target.value }))} style={inputStyle} /></label>
          <label>Momento<select value={session.moment} onChange={(event) => setSession((current) => ({ ...current, moment: event.target.value }))} style={inputStyle}>{TRAINING_MOMENTS.map((moment) => <option key={moment}>{moment}</option>)}</select></label>
        </div>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0 }}>{selectedTest.description} Anota los putts necesarios hasta embocar.</p>

        {isMobile ? <div style={{ display: 'grid', gap: '0.65rem' }}>
          {session.attempts.map((attempt, index) => <div key={`${attempt.distance}-${attempt.direction}-${index}`} style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '0.75rem', background: 'var(--color-surface-soft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}><strong>{attempt.distance} m</strong><span style={{ color: 'var(--color-text-muted)' }}>{attempt.direction}</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Putts hasta embocar<input type="number" min="1" max="8" inputMode="numeric" value={attempt.putts} onChange={(event) => updateAttempt(index, 'putts', event.target.value)} style={{ ...inputStyle, marginTop: '0.25rem' }} aria-label={`Putts ${attempt.distance} metros ${attempt.direction}`} /></label>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Distancia restante<input type="number" min="0" max="20" step="0.25" inputMode="decimal" value={attempt.remainingAfterFirstPutt} onChange={(event) => updateAttempt(index, 'remainingAfterFirstPutt', event.target.value)} style={{ ...inputStyle, marginTop: '0.25rem' }} aria-label={`Distancia restante ${attempt.distance} metros ${attempt.direction}`} /></label>
            </div>
          </div>)}
        </div> : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}><th style={{ padding: '0.6rem' }}>Distancia</th><th style={{ padding: '0.6rem' }}>Pendiente</th><th style={{ padding: '0.6rem', width: '130px' }}>Putts hasta embocar</th><th style={{ padding: '0.6rem', width: '150px' }}>Distancia restante tras 1.º putt</th></tr></thead>
            <tbody>{session.attempts.map((attempt, index) => <tr key={`${attempt.distance}-${attempt.direction}-${index}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '0.6rem', fontWeight: 800 }}>{attempt.distance} m</td>
              <td style={{ padding: '0.6rem' }}>{attempt.direction}</td>
              <td style={{ padding: '0.6rem' }}><input type="number" min="1" max="8" inputMode="numeric" value={attempt.putts} onChange={(event) => updateAttempt(index, 'putts', event.target.value)} style={inputStyle} aria-label={`Putts ${attempt.distance} metros ${attempt.direction}`} /></td>
              <td style={{ padding: '0.6rem' }}><input type="number" min="0" max="20" step="0.25" inputMode="decimal" value={attempt.remainingAfterFirstPutt} onChange={(event) => updateAttempt(index, 'remainingAfterFirstPutt', event.target.value)} style={inputStyle} aria-label={`Distancia restante ${attempt.distance} metros ${attempt.direction}`} /></td>
            </tr>)}</tbody>
          </table>
        </div>}

        <label style={{ display: 'block', marginTop: '1rem' }}>Observaciones<textarea value={session.notes} onChange={(event) => setSession((current) => ({ ...current, notes: event.target.value }))} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} /></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="button" onClick={handleSave} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: 0, borderRadius: '999px', padding: '0.75rem 1.2rem', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}><Check size={16} /> Guardar test</button>
          <span style={{ color: status.includes('No se') ? '#b91c1c' : 'var(--color-text-muted)' }}>{status}</span>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Resumen del test actual</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
          {[['Completados', `${metrics.completed}/${selectedTest.attempts.length}`], ['Putts totales', metrics.totalPutts || '-'], ['Media', metrics.averagePutts === null ? '-' : metrics.averagePutts.toFixed(2)], ['1 putt', formatMetric(metrics.onePuttRate, '%')], ['3 putts', formatMetric(metrics.threePuttRate, '%')], ['Control ≤1 m', formatMetric(metrics.distanceControlRate, '%')]].map(([label, value]) => <div key={label} style={{ background: 'var(--color-surface-soft)', borderRadius: '10px', padding: '0.8rem', textAlign: 'center' }}><div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{label}</div><strong style={{ fontSize: '1.25rem' }}>{value}</strong></div>)}
        </div>
      </div>

      {sessions.length > 0 && <div style={{ ...cardStyle, marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Historial y comparativas</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={exportCsv} style={{ ...secondaryButtonStyle }}><Download size={15} /> Exportar CSV</button>
            <button type="button" onClick={printReport} style={{ ...secondaryButtonStyle }}><Printer size={15} /> Imprimir / PDF</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <label>Periodo<select value={periodType} onChange={(event) => { setPeriodType(event.target.value); setPeriodValue(''); }} style={inputStyle}><option value="all">Todos</option><option value="week">Semana</option><option value="month">Mes</option><option value="season">Temporada</option></select></label>
          <label>Valor<select value={periodValue} onChange={(event) => setPeriodValue(event.target.value)} disabled={periodType === 'all'} style={inputStyle}><option value="">Todos</option>{availablePeriods.map((period) => <option key={period} value={period}>{period}</option>)}</select></label>
          <label>Tipo de test<select value={testFilter} onChange={(event) => setTestFilter(event.target.value)} style={inputStyle}><option value="all">Todos</option>{PUTTING_TESTS.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}</select></label>
        </div>
        {(periodValue || testFilter !== 'all') && <button type="button" onClick={() => { clearFilters(); setTestFilter('all'); }} style={{ ...secondaryButtonStyle, marginBottom: '0.8rem' }}>Limpiar filtros</button>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          {[['Tests', filteredSummary.tests], ['Intentos', filteredSummary.completed], ['Media putts', filteredSummary.averagePutts === null ? '-' : filteredSummary.averagePutts.toFixed(2)], ['1 putt', formatMetric(filteredSummary.onePuttRate, '%')], ['3 putts', formatMetric(filteredSummary.threePuttRate, '%')], ['Control ≤1 m', formatMetric(filteredSummary.distanceControlRate, '%')]].map(([label, value]) => <div key={label} style={{ background: 'var(--color-surface-soft)', borderRadius: '10px', padding: '0.7rem', textAlign: 'center' }}><div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{label}</div><strong>{value}</strong></div>)}
        </div>
        {filteredSessions.map((saved) => { const savedTest = getPuttingTest(saved.testId); const savedMetrics = getSessionMetrics(saved); return <div key={saved.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.8rem 0', borderBottom: '1px solid var(--color-border)' }}><div><strong>{savedTest.name}</strong><div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{saved.date} · {saved.moment} · {savedMetrics.completed}/{savedTest.attempts.length} intentos · media {savedMetrics.averagePutts === null ? '-' : savedMetrics.averagePutts.toFixed(2)} · {getSessionPeriod(saved).week}</div></div><button type="button" title="Eliminar test" onClick={() => handleDelete(saved.id)} style={{ border: 0, background: 'transparent', color: '#b91c1c', cursor: 'pointer' }}><Trash2 size={18} /></button></div>; })}
        {filteredSessions.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No hay tests para estos filtros.</p>}
      </div>}
    </div>
  );
}

const secondaryButtonStyle = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.55rem 0.8rem', background: 'var(--color-bg)', color: 'inherit', fontWeight: 700, cursor: 'pointer' };

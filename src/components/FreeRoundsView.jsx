import { useState } from 'react';
import { CalendarDays, ChevronRight, MapPin, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import spanishCourses from '../data/spanish_courses.json';
import { getScorecardParTotal, resolveCourseScorecard } from '../utils/courseScorecards';

const cardStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '16px',
  padding: '1rem',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.7rem',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  background: 'var(--color-bg)',
  color: 'inherit',
};

const formatDate = (value) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
};

const normalizeCourseName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('es');

const findCatalogCourse = (courseName) => spanishCourses.find(
  (course) => normalizeCourseName(course.name) === normalizeCourseName(courseName),
);

const isValidHolePars = (pars) => {
  if (!Array.isArray(pars) || pars.length !== 18) return false;
  const values = pars.map(Number);
  return !values.some((par) => !Number.isInteger(par) || par < 3 || par > 6);
};

/* Resolve both the total and per-hole pars from the same dated route card. */
const getResolvedCourseData = (courseName, date) => {
  const course = findCatalogCourse(courseName);
  if (!course) return { course: null, scorecard: null, pars: null, totalPar: null };

  const scorecard = resolveCourseScorecard({ course: course.name, dates: formatDate(date) }, course);
  const sourcePars = isValidHolePars(scorecard?.pars) ? scorecard.pars : course.pars;
  const pars = isValidHolePars(sourcePars) ? sourcePars.map(Number) : null;
  return {
    course,
    scorecard,
    pars,
    totalPar: pars ? getScorecardParTotal({ pars }) : null,
  };
};

function FreeRoundForm({ onCancel, onCreate }) {
  const [form, setForm] = useState({
    name: 'Vuelta libre',
    date: new Date().toISOString().slice(0, 10),
    course: '',
    par: '',
  });
  const [error, setError] = useState('');

  const resolvedCourse = getResolvedCourseData(form.course, form.date);
  const calculatedPar = resolvedCourse.totalPar;

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const selectCourse = (value) => {
    setForm((current) => ({ ...current, course: value, par: '' }));
  };

  const submit = () => {
    if (!form.name.trim() || !form.date) {
      setError('Indica un nombre y una fecha.');
      return;
    }
    const resolved = getResolvedCourseData(form.course, form.date);
    const coursePar = resolved.totalPar;
    const par = coursePar ?? Number(form.par);
    if (!Number.isInteger(par) || par < 1) {
      setError('Selecciona un campo del catálogo o introduce manualmente el par total del campo.');
      return;
    }
    onCreate({
      id: `free-round-${form.date}-${Date.now()}`,
      name: form.name.trim(),
      date: form.date,
      dates: formatDate(form.date),
      course: form.course.trim() || 'Campo de golf',
      par,
      pars: isValidHolePars(resolved.pars) ? resolved.pars : null,
      courseVariantId: resolved.scorecard?.variantId || null,
      courseVariantLabel: resolved.scorecard?.label || null,
    });
  };

  return <div style={{ ...cardStyle, marginBottom: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Nueva vuelta libre</h2>
      <button type="button" onClick={onCancel} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} aria-label="Cerrar"><X size={18} /></button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
      <label>Nombre<input value={form.name} onChange={(event) => update('name', event.target.value)} style={inputStyle} /></label>
      <label>Fecha<input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} style={inputStyle} /></label>
      <label>Campo<input value={form.course} onChange={(event) => selectCourse(event.target.value)} list="free-round-course-list" placeholder="Escribe para buscar un campo" style={inputStyle} autoComplete="off" /></label>
      <datalist id="free-round-course-list">
        {spanishCourses.map((course) => <option key={course.name} value={course.name} />)}
      </datalist>
      <label>Par del campo{calculatedPar !== null && <span style={{ display: 'block', marginTop: '0.2rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>Calculado con el recorrido {resolvedCourse.course.name}{resolvedCourse.scorecard?.label ? ` · ${resolvedCourse.scorecard.label}` : ''}</span>}<input type="number" min="1" value={calculatedPar ?? form.par} onChange={(event) => update('par', event.target.value)} readOnly={calculatedPar !== null} placeholder={calculatedPar !== null ? '' : 'Elige un campo o indica el par'} style={{ ...inputStyle, ...(calculatedPar !== null ? { background: 'var(--color-surface-soft)', cursor: 'default' } : {}) }} /></label>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
      <button type="button" onClick={submit} style={{ border: 'none', borderRadius: '999px', padding: '0.7rem 1rem', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}><Plus size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />Crear vuelta</button>
      {error && <span style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</span>}
    </div>
  </div>;
}

export default function FreeRoundsView({ freeRounds = [], onCreateFreeRound }) {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  const create = async (round) => {
    await onCreateFreeRound(round);
    setShowForm(false);
  };

  return <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem', color: 'var(--color-text)' }}>
    <div style={{ ...cardStyle, marginBottom: '1rem', background: 'linear-gradient(135deg, #123b32, #24775a)', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div><div style={{ opacity: 0.75, fontSize: '0.75rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>Registro de juego</div><h1 style={{ margin: '0.25rem 0', fontSize: '1.6rem' }}>Vueltas libres</h1><p style={{ margin: 0, opacity: 0.85 }}>Registra los 18 hoyos y, en la tarjeta, abre «Estadísticas federativas RFEG» para anotar putts, GIR, FIR, distancias, recuperaciones y penalizaciones.</p></div>
        <button type="button" onClick={() => setShowForm(true)} style={{ border: 'none', borderRadius: '999px', padding: '0.75rem 1rem', background: '#f8d67b', color: '#102018', fontWeight: 900, cursor: 'pointer' }}><Plus size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />Nueva vuelta libre</button>
      </div>
    </div>
    {showForm && <FreeRoundForm onCancel={() => setShowForm(false)} onCreate={create} />}
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {freeRounds.map((round) => <button key={round.id} type="button" onClick={() => navigate(`/free-round/${round.id}`)} style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
        <span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: '1.05rem' }}>{round.name}</strong><span style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.35rem', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}><span><CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />{round.dates}</span><span><MapPin size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />{round.course}</span></span></span><ChevronRight size={20} color="var(--color-text-muted)" />
      </button>)}
      {!freeRounds.length && <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--color-text-muted)' }}>Todavía no hay vueltas libres. Crea la primera para registrar sus 18 hoyos.</div>}
    </div>
  </div>;
}

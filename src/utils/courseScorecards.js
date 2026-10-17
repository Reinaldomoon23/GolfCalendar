import courseVariants from '../data/course_variants.json';

const normalizeCourseName = (value = '') => String(value).toLowerCase().trim();

function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTournamentStartDate(dateText) {
  if (!dateText) return null;
  const [firstDate] = String(dateText).split(' - ');
  const [day, month, year] = firstDate.split('/').map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateMatchesVariant(tournamentDate, variant) {
  if (!tournamentDate) return true;

  const from = parseIsoDate(variant.effectiveFrom);
  const to = parseIsoDate(variant.effectiveTo);

  if (from && tournamentDate < from) return false;
  if (to && tournamentDate > to) return false;
  return true;
}

function findVariant(courseName, tournament) {
  const normalized = normalizeCourseName(courseName);
  if (!normalized) return null;

  const group = courseVariants.find((entry) => {
    const entryName = normalizeCourseName(entry.courseName);
    return entryName === normalized || entryName.includes(normalized) || normalized.includes(entryName);
  });
  if (!group?.variants?.length) return null;

  const requestedVariantId = tournament?.courseVariantId || tournament?.course_variant_id || tournament?.scorecard_variant_id;
  if (requestedVariantId) {
    const explicit = group.variants.find((variant) => variant.id === requestedVariantId);
    if (explicit) return explicit;
  }

  const tournamentDate = parseTournamentStartDate(tournament?.dates);
  return group.variants.find((variant) => dateMatchesVariant(tournamentDate, variant)) || null;
}

export function resolveCourseScorecard(tournament, baseCourse = null) {
  const inlinePars = tournament?.scorecard?.pars || tournament?.pars || null;
  if (Array.isArray(inlinePars) && inlinePars.length === 18) {
    return {
      pars: inlinePars,
      meters: tournament?.scorecard?.meters || tournament?.meters || baseCourse?.meters || null,
      handicap: tournament?.scorecard?.handicap || tournament?.handicap || baseCourse?.handicap || null,
      variantId: tournament?.courseVariantId || tournament?.course_variant_id || 'inline',
      label: tournament?.scorecard?.label || tournament?.courseVariantLabel || 'Tarjeta del torneo',
    };
  }

  const variant = findVariant(tournament?.course, tournament);
  if (variant) {
    return {
      pars: variant.pars || baseCourse?.pars || [],
      meters: variant.meters || baseCourse?.meters || null,
      handicap: variant.handicap || baseCourse?.handicap || null,
      courseRating: variant.courseRating || baseCourse?.courseRating || null,
      slopeRating: variant.slopeRating || baseCourse?.slopeRating || null,
      variantId: variant.id,
      label: variant.label || null,
    };
  }

  return {
    pars: baseCourse?.pars || [],
    meters: baseCourse?.meters || null,
    handicap: baseCourse?.handicap || null,
    variantId: null,
    label: null,
  };
}

export function getScorecardParTotal(scorecard) {
  return (scorecard?.pars || []).reduce((sum, value) => sum + (parseInt(value, 10) || 0), 0);
}

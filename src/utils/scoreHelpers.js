/**
 * Score Helpers
 *
 * Utility functions for golf score calculations and handicap logic.
 * Centralizes scoring math to keep components clean and testable.
 */

/**
 * Calculates Stableford points for a hole
 * @param {number} strokes - Number of strokes taken
 * @param {number} par - Par for the hole
 * @param {number} handicapStrokes - Extra strokes given by handicap on this hole (0, 1, or 2)
 * @returns {number} - Stableford points (0 = double bogey+, 1 = bogey, 2 = par, 3 = birdie, etc.)
 *
 * @example
 * calcStableford(4, 4, 0) // 2 (par)
 * calcStableford(3, 4, 0) // 3 (birdie)
 * calcStableford(5, 4, 1) // 2 (bogey, but gets 1 extra stroke → net par)
 */
export function calcStableford(strokes, par, handicapStrokes = 0) {
  if (!strokes || strokes <= 0) return 0;
  const net = strokes - handicapStrokes;
  const diff = par - net;
  return Math.max(0, diff + 2);
}

/**
 * Calculates how many handicap strokes a player gets on a given hole
 * @param {number} playerHandicap - Player's course handicap (integer)
 * @param {number} holeIndex - Hole's stroke index (1 = hardest, 18 = easiest)
 * @returns {number} - Extra strokes (0, 1, or 2)
 *
 * @example
 * getHandicapStrokesForHole(18, 1) // 1
 * getHandicapStrokesForHole(18, 18) // 1
 * getHandicapStrokesForHole(36, 1) // 2
 * getHandicapStrokesForHole(36, 18) // 2
 */
export function getHandicapStrokesForHole(playerHandicap, holeIndex) {
  if (!playerHandicap || !holeIndex) return 0;
  const strokes = Math.floor(playerHandicap / 18);
  const remainder = playerHandicap % 18;
  return strokes + (holeIndex <= remainder ? 1 : 0);
}

/**
 * Calculates the course handicap from playing handicap index
 * @param {number} handicapIndex - WHS Handicap Index (e.g., 14.5)
 * @param {number} slopeRating - Course slope rating (default 113)
 * @param {number} courseRating - Course rating
 * @param {number} par - Course par
 * @returns {number} - Course handicap (rounded integer)
 *
 * @example
 * calcCourseHandicap(14.5, 125, 71.2, 72) // 17
 */
export function calcCourseHandicap(handicapIndex, slopeRating = 113, courseRating = 72, par = 72) {
  if (!handicapIndex) return 0;
  const raw = (handicapIndex * (slopeRating / 113)) + (courseRating - par);
  return Math.round(raw);
}

/**
 * Sums an array of Stableford points, ignoring null/undefined holes
 * @param {Array<number|null>} points - Array of hole points
 * @returns {number} - Total points
 */
export function sumStableford(points) {
  if (!Array.isArray(points)) return 0;
  return points.reduce((acc, p) => acc + (p ?? 0), 0);
}

/**
 * Sums an array of strokes, ignoring null/undefined holes
 * @param {Array<number|null>} strokes - Array of strokes per hole
 * @returns {number} - Total strokes
 */
export function sumStrokes(strokes) {
  if (!Array.isArray(strokes)) return 0;
  return strokes.reduce((acc, s) => acc + (s ?? 0), 0);
}

/**
 * Calculates the score relative to par (e.g., -3, E, +5)
 * @param {number} totalStrokes - Total strokes played
 * @param {number} coursePar - Course par
 * @returns {string} - Score vs par string ("E", "-3", "+5")
 */
export function scoreToPar(totalStrokes, coursePar) {
  if (!totalStrokes || !coursePar) return '-';
  const diff = totalStrokes - coursePar;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : String(diff);
}

/**
 * Returns a CSS color class name based on score vs par
 * @param {number} strokes - Strokes on hole
 * @param {number} par - Par for hole
 * @returns {string} - Color label: 'eagle', 'birdie', 'par', 'bogey', 'double', 'worse'
 *
 * @example
 * scoreColor(3, 4) // 'birdie'
 * scoreColor(2, 4) // 'eagle'
 * scoreColor(6, 4) // 'double'
 */
export function scoreColor(strokes, par) {
  if (!strokes || !par) return '';
  const diff = strokes - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  if (diff === 2) return 'double';
  return 'worse';
}

/**
 * Formats a handicap index for display
 * @param {number|string|null} handicap - Raw handicap value
 * @returns {string} - Formatted handicap (e.g., "14.5", "+2.1", "N/A")
 *
 * @example
 * formatHandicap(14.5) // "14.5"
 * formatHandicap(-2.1) // "+2.1"
 * formatHandicap(null) // "N/A"
 */
export function formatHandicap(handicap) {
  if (handicap === null || handicap === undefined || handicap === '') return 'N/A';
  const num = parseFloat(handicap);
  if (isNaN(num)) return String(handicap);
  if (num < 0) return `+${Math.abs(num).toFixed(1)}`;
  return num.toFixed(1);
}

/**
 * Rounds strokes result to valid golf score (min 1 per hole)
 * @param {number} strokes - Raw strokes value
 * @returns {number|null} - Validated strokes or null if invalid
 */
export function validateStrokes(strokes) {
  const n = parseInt(strokes, 10);
  if (isNaN(n) || n < 1) return null;
  return n;
}

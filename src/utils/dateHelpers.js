/**
 * Date Helpers
 *
 * Utility functions for parsing and manipulating dates in the golf tracker app.
 * Extracted from CalendarView.jsx for reusability and testing.
 */

/**
 * Parses a date string or range and returns start and end dates
 * @param {string} dateStr - Format: "DD/MM/YYYY" or "DD/MM/YYYY - DD/MM/YYYY"
 * @returns {{ start: Date, end: Date }} - Start and end date objects
 *
 * @example
 * parseDateHelper("25/03/2026") // { start: Date(2026-03-25), end: Date(2026-03-25) }
 * parseDateHelper("25/03/2026 - 27/03/2026") // { start: Date(2026-03-25), end: Date(2026-03-27) }
 */
export function parseDateHelper(dateStr) {
  if (!dateStr) return { start: null, end: null };

  const parts = dateStr.split(' - ');
  const startParts = parts[0].split('/');
  const start = new Date(startParts[2], startParts[1] - 1, startParts[0]);

  if (parts.length > 1) {
    const endParts = parts[1].split('/');
    const end = new Date(endParts[2], endParts[1] - 1, endParts[0]);
    return { start, end };
  }

  return { start, end: start };
}

/**
 * Generates an array of dates for tournament rounds
 * @param {string} dateStr - Format: "DD/MM/YYYY" or "DD/MM/YYYY - DD/MM/YYYY"
 * @returns {Date[]} - Array of date objects for each day of the tournament
 *
 * @example
 * getRoundDates("25/03/2026 - 27/03/2026")
 * // [Date(2026-03-25), Date(2026-03-26), Date(2026-03-27)]
 */
export function getRoundDates(dateStr) {
  const { start, end } = parseDateHelper(dateStr);
  if (!start) return [];

  const dates = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Parses a date string and returns only the first date
 * @param {string} dateStr - Format: "DD/MM/YYYY" or "DD/MM/YYYY - DD/MM/YYYY"
 * @returns {Date|null} - First date object or null
 *
 * @example
 * parseDate("25/03/2026 - 27/03/2026") // Date(2026-03-25)
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split(' - ')[0].split('/');
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

/**
 * Checks if a tournament date has already passed
 * @param {string} dateStr - Format: "DD/MM/YYYY" or "DD/MM/YYYY - DD/MM/YYYY"
 * @returns {boolean} - True if the end date is in the past
 *
 * @example
 * isPast("25/03/2025") // true (if today is after that date)
 */
export function isPast(dateStr) {
  const { end } = parseDateHelper(dateStr);
  if (!end) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return end < today;
}

/**
 * Extracts the year from a date string
 * @param {string} dateStr - Format: "DD/MM/YYYY" or "DD/MM/YYYY - DD/MM/YYYY"
 * @returns {string} - Year as string (e.g., "2026")
 *
 * @example
 * getYear("25/03/2026 - 27/03/2026") // "2026"
 */
export function getYear(dateStr) {
  if (!dateStr) return '';

  // Handle range: take the first date
  const firstDate = dateStr.split(' - ')[0];
  const parts = firstDate.split('/');

  return parts.length === 3 ? parts[2] : '';
}

/**
 * Normalizes various timestamp formats to milliseconds
 * @param {number|string|object} value - Timestamp in various formats
 * @returns {number} - Timestamp in milliseconds, or 0 if invalid
 *
 * @example
 * normalizeTimestamp(1711324800000) // 1711324800000
 * normalizeTimestamp("2026-03-25T00:00:00Z") // 1711324800000
 * normalizeTimestamp({ toMillis: () => 1711324800000 }) // 1711324800000 (Firestore Timestamp)
 */
export function normalizeTimestamp(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  // Handle Firestore Timestamp objects
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return 0;
}

/**
 * Formats a Date object to DD/MM/YYYY string
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 *
 * @example
 * formatDate(new Date(2026, 2, 25)) // "25/03/2026"
 */
export function formatDate(date) {
  if (!date || !(date instanceof Date)) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Checks if two date ranges overlap
 * @param {string} range1 - First date range "DD/MM/YYYY - DD/MM/YYYY"
 * @param {string} range2 - Second date range "DD/MM/YYYY - DD/MM/YYYY"
 * @returns {boolean} - True if ranges overlap
 *
 * @example
 * datesOverlap("25/03/2026 - 27/03/2026", "26/03/2026 - 28/03/2026") // true
 * datesOverlap("25/03/2026 - 27/03/2026", "28/03/2026 - 30/03/2026") // false
 */
export function datesOverlap(range1, range2) {
  const { start: start1, end: end1 } = parseDateHelper(range1);
  const { start: start2, end: end2 } = parseDateHelper(range2);

  if (!start1 || !start2) return false;

  return start1 <= end2 && start2 <= end1;
}

/**
 * Application Configuration
 *
 * Core app settings and defaults
 */

// Environment Mode: 'single' (Nicole) or 'multi' (Team)
export const APP_MODE = import.meta.env.VITE_APP_MODE || 'single';
export const IS_MULTI = APP_MODE === 'multi';

// Default user for Single Mode
export const DEFAULT_USER = {
  username: 'nicole',
  full_name: 'Calendario Nicole Likhomanova',
  photo_url: 'nicole.jpg',
};

// Default user preferences
export const DEFAULT_PREFERENCES = {
  groups: ['juvenil', 'rfeg', 'fcg', 'club', 'adultos'],
  hiddenIds: [],
  themes: {}
};

// Handicap cache settings
export const HANDICAP_CACHE_KEY_PREFIX = 'golf_tracker_handicap_cache';
export const HANDICAP_CACHE_HOURS = 24; // Valid until next 08:00 AM

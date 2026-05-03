/**
 * API Endpoints Configuration
 */

export const API_ENDPOINTS = {
  // Handicap service (Vercel Serverless proxy) - Absolute URL ensures it works regardless of PWA hosting domain
  handicap: "https://golf-calendar-v3.vercel.app/api/get_handicap",

  // Legacy PHP endpoints (fallback)
  updateUser: "/api/update_user.php",
  users: "/api/users.json",
};

// API request timeout (milliseconds)
export const API_TIMEOUT = 10000; // 10 seconds

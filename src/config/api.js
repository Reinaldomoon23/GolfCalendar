/**
 * API Endpoints Configuration
 */

export const API_ENDPOINTS = {
  // Handicap service (PHP legacy)
  handicap: "https://reinaldomoon.top/GolfTeam/api/get_handicap.php",

  // Legacy PHP endpoints (fallback)
  updateUser: "/api/update_user.php",
  users: "/api/users.json",
};

// API request timeout (milliseconds)
export const API_TIMEOUT = 10000; // 10 seconds

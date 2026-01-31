<?php
// Allow CORS if needed
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Helper to get filename based on username
function getResultsFile($username) {
    // Sanitize username to prevent directory traversal
    $clean_username = preg_replace('/[^a-zA-Z0-9_-]/', '', $username);
    if (empty($clean_username)) return null;
    return __DIR__ . '/../data/results_' . $clean_username . '.json';
}

// Ensure data directory exists
$dataDir = __DIR__ . '/../data';
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

// Migration helper: Move old results.json if specific user requests it and doesn't have one?
// For now, let's keep it simple.

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get raw POST data
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if ($data === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    $username = $data['username'] ?? null;
    $results = $data['results'] ?? null;

    if (!$username || !$results) {
        // Fallback for backward compatibility or error?
        // Let's enforce username for now as we are switching modes.
        http_response_code(400);
        echo json_encode(['error' => 'Username and results required']);
        exit;
    }

    $file = getResultsFile($username);
    if (!$file) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid username']);
        exit;
    }

    // Save to user-specific file
    if (file_put_contents($file, json_encode($results, JSON_PRETTY_PRINT))) {
        echo json_encode(['success' => true, 'message' => 'Data saved successfully']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to write to file']);
    }

} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $username = $_GET['username'] ?? null;
    
    // For backward compatibility, if no username, maybe read default? 
    // Or return empty.
    if (!$username) {
        // Fallback to old results.json if needed, or just return empty
        $oldFile = __DIR__ . '/../results.json';
        if (file_exists($oldFile)) {
             echo file_get_contents($oldFile);
        } else {
             echo json_encode((object)[]);
        }
        exit;
    }

    $file = getResultsFile($username);
    if ($file && file_exists($file)) {
        echo file_get_contents($file);
    } else {
        // If user specific file doesn't exist, check if we should migrate old data?
        // Maybe easier to start fresh or manually copy.
        echo json_encode((object)[]);
    }
}
?>

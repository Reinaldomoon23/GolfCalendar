<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Helper to get filename based on username
function getHistoryFile($username) {
    // Sanitize username to prevent directory traversal
    $clean_username = preg_replace('/[^a-zA-Z0-9_-]/', '', $username);
    if (empty($clean_username)) return null;
    return __DIR__ . '/../data/handicap_history_' . $clean_username . '.json';
}

// Ensure data directory exists
$dataDir = __DIR__ . '/../data';
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if ($data === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    $username = $data['username'] ?? null;
    $history = $data['history'] ?? null;

    if (!$username || !$history) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and history data required']);
        exit;
    }

    $file = getHistoryFile($username);
    if (!$file) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid username']);
        exit;
    }

    // Prepare history data (ensure it is array)
    if (!is_array($history)) {
        http_response_code(400);
        echo json_encode(['error' => 'History must be an array']);
        exit;
    }

    if (file_put_contents($file, json_encode($history, JSON_PRETTY_PRINT), LOCK_EX)) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to write to file']);
    }

} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $username = $_GET['username'] ?? 'nicole'; // Default to nicole for backward capability
    
    $file = getHistoryFile($username);
    
    if ($file && file_exists($file)) {
        echo file_get_contents($file);
    } else {
        echo json_encode([]);
    }
}
?>

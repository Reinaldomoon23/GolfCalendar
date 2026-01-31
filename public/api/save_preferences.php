<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Helper: safe filename
function getPrefsFile($username) {
    $clean = preg_replace('/[^a-zA-Z0-9_-]/', '', $username);
    if (empty($clean)) return null;
    return __DIR__ . '/../data/prefs_' . $clean . '.json';
}

$dataDir = __DIR__ . '/../data';
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = $input['username'] ?? null;
    $prefs = $input['preferences'] ?? null;

    if (!$username || !$prefs) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing username or preferences']);
        exit;
    }

    $file = getPrefsFile($username);
    if (file_put_contents($file, json_encode($prefs, JSON_PRETTY_PRINT))) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Write failed']);
    }

} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $username = $_GET['username'] ?? null;
    if (!$username) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing username']);
        exit;
    }

    $file = getPrefsFile($username);
    if (file_exists($file)) {
        echo file_get_contents($file);
    } else {
        // Default preferences
        echo json_encode([
            'groups' => ['grand_prix', 'valedero', 'baby_cup', 'legacy', 'club'] // Default all enabled? Or empty?
            // User requested to "load" them. Maybe default is all on, or all off?
            // Let's default to ALL ON so they see something initially.
        ]);
    }
}
?>

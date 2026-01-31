<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function getTournamentsFile($username) {
    $clean_username = preg_replace('/[^a-zA-Z0-9_-]/', '', $username);
    if (empty($clean_username)) return null;
    return __DIR__ . '/../data/custom_tournaments_' . $clean_username . '.json';
}

$dataDir = __DIR__ . '/../data';
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if ($data === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    $username = $data['username'] ?? null;
    $tournaments = $data['tournaments'] ?? null;

    if (!$username || $tournaments === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and tournaments required']);
        exit;
    }

    $file = getTournamentsFile($username);
    if (!$file) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid username']);
        exit;
    }

    if (file_put_contents($file, json_encode($tournaments, JSON_PRETTY_PRINT))) {
        echo json_encode(['success' => true, 'message' => 'Custom tournaments saved successfully']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to write to file']);
    }

} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $username = $_GET['username'] ?? null;
    
    if (!$username) {
        http_response_code(400);
        echo json_encode(['error' => 'Username required']);
        exit;
    }

    $file = getTournamentsFile($username);
    if ($file && file_exists($file)) {
        echo file_get_contents($file);
    } else {
        echo json_encode([]);
    }
}
?>

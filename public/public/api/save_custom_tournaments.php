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


    // Debug Logging
    $logFile = $dataDir . '/debug_tournaments.log';
    $logEntry = date('Y-m-d H:i:s') . " - Request: " . $_SERVER['REQUEST_METHOD'] . "\n";

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);

        if ($data === null) {
            $logEntry .= "ERROR: Invalid JSON\n";
            file_put_contents($logFile, $logEntry, FILE_APPEND);
            
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON']);
            exit;
        }

        $username = $data['username'] ?? 'MISSING';
        $tournaments = $data['tournaments'] ?? null;
        $count = is_array($tournaments) ? count($tournaments) : 'null';

        $logEntry .= "User: $username | Tournaments Count: $count\n";

        if (!$username || $tournaments === null) {
            $logEntry .= "ERROR: Username or tournaments missing\n";
            file_put_contents($logFile, $logEntry, FILE_APPEND);

            http_response_code(400);
            echo json_encode(['error' => 'Username and tournaments required']);
            exit;
        }

        $file = getTournamentsFile($username);
        if (!$file) {
            $logEntry .= "ERROR: Invalid username chars\n";
            file_put_contents($logFile, $logEntry, FILE_APPEND);

            http_response_code(400);
            echo json_encode(['error' => 'Invalid username']);
            exit;
        }

        if (file_put_contents($file, json_encode($tournaments, JSON_PRETTY_PRINT))) {
            $logEntry .= "SUCCESS: Saved to $file\n";
            echo json_encode(['success' => true, 'message' => 'Custom tournaments saved successfully']);
        } else {
            $logEntry .= "ERROR: Failed to write file to $file\n";
            http_response_code(500);
            echo json_encode(['error' => 'Failed to write to file']);
        }
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $username = $_GET['username'] ?? null;
        $logEntry .= "GET User: " . ($username ?? 'NULL') . "\n";
        
        if (!$username) {
            file_put_contents($logFile, $logEntry, FILE_APPEND);
            http_response_code(400);
            echo json_encode(['error' => 'Username required']);
            exit;
        }

        $file = getTournamentsFile($username);
        if ($file && file_exists($file)) {
            $content = file_get_contents($file);
            $logEntry .= "Read: " . strlen($content) . " bytes\n";
            echo $content;
        } else {
            $logEntry .= "File not found, returning []\n";
            echo json_encode([]);
        }
    }
    
    file_put_contents($logFile, $logEntry, FILE_APPEND);
?>

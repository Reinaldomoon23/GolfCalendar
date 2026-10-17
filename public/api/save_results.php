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

// --- AUTOMATIC DAILY BACKUP CHECK ---
$backupBaseDir = __DIR__ . '/../backups';
$markerFile = $backupBaseDir . '/last_backup_date.txt';
$today = date('Y-m-d');
$lastBackupDate = '';

if (file_exists($markerFile)) {
    $lastBackupDate = trim(file_get_contents($markerFile));
}

// If backup not done today, trigger it safely
if ($lastBackupDate !== $today) {
    // We can include the logic directly or make a local HTTP request. 
    // Including is faster and doesn't rely on self-HTTP which might be blocked or slow.
    // Wrap in try/catch to not break the save flow
    try {
        if (!file_exists($backupBaseDir)) {
            mkdir($backupBaseDir, 0755, true);
        }
        
        // Define helpers for backup if not already defined (in case of weird include scope)
        if (!function_exists('recursiveDelete')) {
            function recursiveDelete($dir) {
                if (!file_exists($dir)) return true;
                if (!is_dir($dir)) return unlink($dir);
                foreach (scandir($dir) as $item) {
                    if ($item == '.' || $item == '..') continue;
                    if (!recursiveDelete($dir . DIRECTORY_SEPARATOR . $item)) return false;
                }
                return rmdir($dir);
            }
        }
        if (!function_exists('recursiveCopy')) {
            function recursiveCopy($src, $dst) {
                $dir = opendir($src);
                @mkdir($dst);
                while(false !== ( $file = readdir($dir)) ) {
                    if (( $file != '.' ) && ( $file != '..' )) {
                        if ( is_dir($src . '/' . $file) ) {
                            recursiveCopy($src . '/' . $file, $dst . '/' . $file);
                        } else {
                            copy($src . '/' . $file, $dst . '/' . $file);
                        }
                    }
                }
                closedir($dir);
            }
        }

        // Rotation: 2->3, 1->2
        $backup3 = $backupBaseDir . '/backup_3';
        if (file_exists($backup3)) recursiveDelete($backup3);
        
        $backup2 = $backupBaseDir . '/backup_2';
        if (file_exists($backup2)) rename($backup2, $backup3);
        
        $backup1 = $backupBaseDir . '/backup_1';
        if (file_exists($backup1)) rename($backup1, $backup2);
        
        // Current Data -> Backup 1
        if (file_exists($dataDir)) {
            recursiveCopy($dataDir, $backup1);
            file_put_contents($markerFile, $today);
        }
        
    } catch (Exception $e) {
        // Silently fail backup so we don't block the user's save
        // error_log("Backup failed: " . $e->getMessage());
    }
}
// ------------------------------------

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

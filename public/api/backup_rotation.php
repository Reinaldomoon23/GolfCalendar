<?php
// backup_rotation.php
// Creates a daily backup of the /data directory with a 3-day rotation policy.
// backup_1 (Newest) -> backup_2 -> backup_3 (Oldest)

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Define paths
$baseDir = __DIR__ . '/..';
$dataDir = $baseDir . '/data';
$backupBaseDir = $baseDir . '/backups';
$markerFile = $backupBaseDir . '/last_backup_date.txt';

// Ensure backup directory exists
if (!file_exists($backupBaseDir)) {
    if (!mkdir($backupBaseDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create backup directory']);
        exit;
    }
}

// Check if backup already performed today
$today = date('Y-m-d');
$lastBackupDate = '';

if (file_exists($markerFile)) {
    $lastBackupDate = trim(file_get_contents($markerFile));
}

if ($lastBackupDate === $today) {
    echo json_encode(['success' => true, 'message' => 'Backup already up to date for ' . $today]);
    exit;
}

// Helper: Recursively Delete Directory
function recursiveDelete($dir) {
    if (!file_exists($dir)) return true;
    if (!is_dir($dir)) return unlink($dir);
    
    foreach (scandir($dir) as $item) {
        if ($item == '.' || $item == '..') continue;
        if (!recursiveDelete($dir . DIRECTORY_SEPARATOR . $item)) return false;
    }
    return rmdir($dir);
}

// Helper: Recursively Copy Directory
function recursiveCopy($src, $dst) {
    $dir = opendir($src);
    @mkdir($dst);
    while(false !== ( $file = readdir($dir)) ) {
        if (( $file != '.' ) && ( $file != '..' )) {
            if ( is_dir($src . '/' . $file) ) {
                recursiveCopy($src . '/' . $file, $dst . '/' . $file);
            }
            else {
                copy($src . '/' . $file, $dst . '/' . $file);
            }
        }
    }
    closedir($dir);
}

// Perform Rotation
// 1. Delete backup_3 (Oldest)
$backup3 = $backupBaseDir . '/backup_3';
if (file_exists($backup3)) {
    recursiveDelete($backup3);
}

// 2. Move backup_2 to backup_3
$backup2 = $backupBaseDir . '/backup_2';
if (file_exists($backup2)) {
    rename($backup2, $backup3);
}

// 3. Move backup_1 to backup_2
$backup1 = $backupBaseDir . '/backup_1';
if (file_exists($backup1)) {
    rename($backup1, $backup2);
}

// 4. Copy current data to backup_1
if (file_exists($dataDir)) {
    recursiveCopy($dataDir, $backup1);
    
    // Update marker file
    file_put_contents($markerFile, $today);
    
    echo json_encode([
        'success' => true, 
        'message' => 'Backup rotation completed successfully',
        'date' => $today,
        'details' => 'Rotated: 2->3, 1->2, Current->1'
    ]);
} else {
    echo json_encode(['error' => 'Data directory not found']);
}
?>

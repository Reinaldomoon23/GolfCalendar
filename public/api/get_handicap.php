<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Simple Autoloader for Smalot PDF Parser
spl_autoload_register(function ($class) {
    if (strpos($class, 'Smalot\\PdfParser\\') === 0) {
        $path = __DIR__ . '/pdfparser/' . str_replace('\\', '/', $class) . '.php';
        if (file_exists($path)) {
            require_once $path;
        }
    }
});

use Smalot\PdfParser\Parser;

$username = $_GET['username'] ?? 'nicole'; 
$passedLicense = $_GET['license'] ?? '';

// Load User Config
$usersFile = __DIR__ . '/users.json';
$pdfUrl = '';

// Priority 1: License passed via URL (from Firestore/Frontend)
if (!empty($passedLicense)) {
    if (preg_match('/(\d+)$/', $passedLicense, $matches)) {
        $shortId = substr($matches[1], -6);
        $pdfUrl = 'https://api.rfeg.es/files/summaryhandicap/' . $shortId . '.pdf';
    }
}

// Priority 2: Look in users.json (Legacy/Fallback)
if (empty($pdfUrl) && file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true);
    if (isset($users[$username])) {
        $userData = $users[$username];
        if (!empty($userData['handicap_url'])) {
            $pdfUrl = $userData['handicap_url'];
        } elseif (!empty($userData['federation_id'])) {
             if (preg_match('/(\d+)$/', $userData['federation_id'], $matches)) {
                $shortId = substr($matches[1], -6);
                $pdfUrl = 'https://api.rfeg.es/files/summaryhandicap/' . $shortId . '.pdf';
            }
        }
    }
}

// Global Default Fallback if still empty
if (empty($pdfUrl)) {
    // Graceful exit for users without license
    echo json_encode(['handicap' => null, 'pdf_url' => null, 'message' => 'No license found']);
    exit;
}

try {
    // 1. Fetch PDF content
    // 1. Fetch PDF content with CURL and Cache Busting
    $ch = curl_init();
    $urlWithInitParams = $pdfUrl . (strpos($pdfUrl, '?') === false ? '?' : '&') . 't=' . microtime(true);
    
    curl_setopt($ch, CURLOPT_URL, $urlWithInitParams);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    // Mimic a browser to avoid getting cached/stale/blocked content
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36");
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Cache-Control: no-cache",
        "Pragma: no-cache"
    ]);

    $pdfContent = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200 || !$pdfContent) {
        throw new Exception("Failed to fetch PDF. HTTP Code: " . $httpCode . " Error: " . $curlError);
    }

    // 2. Parse PDF
    $parser = new Parser();
    $pdf = $parser->parseContent($pdfContent);
    $text = $pdf->getText();

    // 3. Extract Handicap
    if (preg_match('/NUEVO\s+H[AÁ]NDICAP\s*:\s*([\d\.]+)/iu', $text, $matches)) {
        $handicapValue = $matches[1];
        echo json_encode([
            'handicap' => $handicapValue,
            'pdf_url' => $pdfUrl
        ]);
        
        // --- AUTO-SAVE LOGIC PER USER ---
        $clean_username = preg_replace('/[^a-zA-Z0-9_-]/', '', $username);
        $historyFile = __DIR__ . '/../data/handicap_history_' . $clean_username . '.json';
        
        // Ensure data dir exists
        if (!file_exists(dirname($historyFile))) {
             mkdir(dirname($historyFile), 0777, true);
        }

        $today = date('Y-m-d');
        
        $historyData = [];
        if (file_exists($historyFile)) {
            $content = file_get_contents($historyFile);
            $historyData = json_decode($content, true);
            if (!is_array($historyData)) $historyData = [];
        }

        // Check if today already exists
        $exists = false;
        // Check if today already exists and update it, or add new
        $exists = false;
        foreach ($historyData as &$entry) {
            if (isset($entry['date']) && $entry['date'] === $today) {
                $entry['handicap'] = (float)$handicapValue;
                $exists = true;
                break;
            }
        }
        unset($entry); // Break reference

        if (!$exists) {
            $historyData[] = [
                'date' => $today,
                'handicap' => (float)$handicapValue
            ];
        }
        
        // Sort by date just in case
        usort($historyData, function($a, $b) {
            return strcmp($a['date'], $b['date']);
        });
        
        file_put_contents($historyFile, json_encode($historyData, JSON_PRETTY_PRINT));
        // -----------------------
    } else {
        echo json_encode(['error' => 'Handicap not found in PDF']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>

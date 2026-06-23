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

function looksLikePdfContent($content) {
    if (!$content || !is_string($content)) return false;
    return strlen($content) > 1000 && strpos(ltrim($content), '%PDF') === 0;
}

function fetchPdfContent($url) {
    $lastHttpCode = 0;
    $lastCurlError = '';

    for ($attempt = 1; $attempt <= 3; $attempt++) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_ENCODING => '',
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_USERAGENT => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            CURLOPT_REFERER => "https://www.rfegolf.es/",
            CURLOPT_HTTPHEADER => [
                "Cache-Control: no-cache",
                "Pragma: no-cache",
                "Accept: application/pdf,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
            ],
        ]);

        $content = curl_exec($ch);
        $lastHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $lastCurlError = curl_error($ch);
        curl_close($ch);

        if ($lastHttpCode === 200 && looksLikePdfContent($content)) {
            return $content;
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", [
                    'Cache-Control: no-cache',
                    'Pragma: no-cache',
                    'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Referer: https://www.rfegolf.es/',
                    'Accept: application/pdf,*/*'
                ]),
                'timeout' => 20,
                'ignore_errors' => true,
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $fallbackContent = @file_get_contents($url, false, $context);
        if (looksLikePdfContent($fallbackContent)) {
            return $fallbackContent;
        }

        usleep(250000);
    }

    throw new Exception("Failed to fetch PDF. HTTP Code: " . $lastHttpCode . " Error: " . $lastCurlError);
}

$username = $_GET['username'] ?? 'nicole'; 
$passedLicense = $_GET['license'] ?? '';

// Load User Config
$usersFile = __DIR__ . '/users.json';
$pdfUrl = '';

// Priority 1: License passed via URL (from Firestore/Frontend)
if (!empty($passedLicense)) {
    if (preg_match('/(\d+)$/', $passedLicense, $matches)) {
        $shortId = substr($matches[1], -6); // Get last 6 digits
        $pdfUrl = 'https://api.rfeg.es/files/summaryhandicap/' . $shortId . '.pdf';
    }
}

// Priority 2: Look in users.json (Legacy/Fallback)
if (empty($pdfUrl) && file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true);
    if (isset($users[$username])) {
        $userData = $users[$username];
        if (!empty($userData['federation_id'])) {
            if (preg_match('/(\d+)$/', $userData['federation_id'], $matches)) {
                $shortId = substr($matches[1], -6);
                $pdfUrl = 'https://api.rfeg.es/files/summaryhandicap/' . $shortId . '.pdf';
            }
        } elseif (!empty($userData['handicap_url'])) {
            $pdfUrl = $userData['handicap_url'];
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
    $pdfContent = fetchPdfContent($pdfUrl);

    // 2. Parse PDF
    $parser = new Parser();
    $pdf = $parser->parseContent($pdfContent);
    $text = $pdf->getText();

    // 3. Extract Handicap
    if (preg_match('/NUEVO\s+H[AÁ]NDICAP\s*:\s*([\d\.]+)/iu', $text, $matches)) {
        $handicapValue = $matches[1];
        echo json_encode([
            'handicap' => $handicapValue,
            'pdf_url'  => $pdfUrl
        ]);
    } else {
        echo json_encode(['error' => 'Handicap not found in PDF']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>

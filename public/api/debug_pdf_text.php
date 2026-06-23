<?php
/**
 * DEBUG: Muestra el texto extraído del PDF y prueba distintas regex
 * Uso: /api/debug_pdf_text.php?username=nicole&license=CB00123456
 * Solo activar temporalmente.
 */
header("Content-Type: text/plain; charset=utf-8");
ini_set('display_errors', 1);
error_reporting(E_ALL);

spl_autoload_register(function ($class) {
    if (strpos($class, 'Smalot\\PdfParser\\') === 0) {
        $path = __DIR__ . '/pdfparser/' . str_replace('\\', '/', $class) . '.php';
        if (file_exists($path)) require_once $path;
    }
});
use Smalot\PdfParser\Parser;

$license = $_GET['license'] ?? '';
if (empty($license)) {
    // Try users.json fallback
    $users = json_decode(file_get_contents(__DIR__ . '/users.json'), true);
    $username = $_GET['username'] ?? 'nicole';
    $license = $users[$username]['federation_id'] ?? '';
}

if (empty($license)) { die("No license found"); }

// Build URL
if (preg_match('/(\d+)$/', $license, $m)) {
    $shortId = substr($m[1], -6);
    $pdfUrl = 'https://api.rfeg.es/files/summaryhandicap/' . $shortId . '.pdf';
} else { die("Invalid license"); }

echo "PDF URL: $pdfUrl\n\n";

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $pdfUrl . '?t=' . microtime(true),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_USERAGENT => "Mozilla/5.0 (compatible; GolfCalendar/1.0)",
    CURLOPT_HTTPHEADER => ["Cache-Control: no-cache"],
]);
$content = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP: $code | Size: " . strlen($content) . " bytes\n\n";
if ($code !== 200 || !$content) die("Failed to fetch PDF");

$parser = new Parser();
$pdf = $parser->parseContent($content);
$text = $pdf->getText();

echo "=== FULL PDF TEXT (first 4000 chars) ===\n";
echo substr($text, 0, 4000);
echo "\n\n=== SEARCHING FOR DATE PATTERN ===\n";

// Test 1: find any date
preg_match_all('/\d{2}\/\d{2}\/\d{4}/', $text, $m1);
echo "Dates found: " . count($m1[0]) . "\n";
foreach (array_slice($m1[0], 0, 5) as $d) echo "  $d\n";

echo "\n=== SEARCHING FOR Vc/Vs/Par PATTERN (digits.digit/digits/digits) ===\n";
preg_match_all('/\d+\.\d+\/\d+\/\d+/', $text, $m2);
echo "Vc/Vs/Par found: " . count($m2[0]) . "\n";
foreach (array_slice($m2[0], 0, 5) as $p) echo "  $p\n";

echo "\n=== BLOCK DETECTION ===\n";
$startMarkers = ['1. Se toman los últimos', '1. Se toman los ultimos', '1. Se toman'];
$endMarkers   = ['2. Para cada resultado', '2. Para cada'];

$blockStart = false; $blockEnd = false;
foreach ($startMarkers as $mk) {
    $pos = mb_strpos($text, $mk);
    if ($pos !== false) { $blockStart = $pos; echo "Block start found: '$mk' at pos $pos\n"; break; }
}
foreach ($endMarkers as $mk) {
    $pos = mb_strpos($text, $mk);
    if ($pos !== false) { $blockEnd = $pos; echo "Block end found: '$mk' at pos $pos\n"; break; }
}

if ($blockStart !== false && $blockEnd !== false) {
    $block = mb_substr($text, $blockStart, $blockEnd - $blockStart);
    echo "\n=== BLOCK 1 (first 2000 chars) ===\n";
    echo substr($block, 0, 2000);
} else {
    echo "Block NOT found! Looking for context around first date...\n";
    if (count($m1[0]) > 0) {
        $firstDatePos = strpos($text, $m1[0][0]);
        echo "\n=== 500 chars around first date ===\n";
        echo substr($text, max(0, $firstDatePos - 100), 600);
    }
}

echo "\n\n=== PYTHON-STYLE REGEX TEST ===\n";
// Exact translation of the Python regex
$pattern = '/(\d{2}\/\d{2}\/\d{4}).+?(\d+\.\d+)\/(\d+)\/(\d+)\s+([+-]?\d+\.\d+)/su';
$searchText = ($blockStart !== false && $blockEnd !== false)
    ? mb_substr($text, $blockStart, $blockEnd - $blockStart)
    : $text;

if (preg_match_all($pattern, $searchText, $matches, PREG_SET_ORDER)) {
    echo "Matches: " . count($matches) . "\n";
    foreach ($matches as $m) {
        echo "  Date: {$m[1]}  Vc/Vs/Par: {$m[2]}/{$m[3]}/{$m[4]}  SMH_hcp: {$m[5]}\n";
    }
} else {
    echo "NO MATCHES with Python-style regex\n";
    echo "\nTrying line-by-line...\n";
    $lines = explode("\n", $searchText);
    foreach ($lines as $i => $line) {
        if (preg_match('/\d{2}\/\d{2}\/\d{4}/', $line)) {
            echo "Line $i: " . trim($line) . "\n";
        }
    }
}
?>

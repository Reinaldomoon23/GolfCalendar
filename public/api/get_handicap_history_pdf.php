<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

ini_set('display_errors', 0);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

// Simple Autoloader for Smalot PDF Parser
spl_autoload_register(function ($class) {
    if (strpos($class, 'Smalot\\PdfParser\\') === 0) {
        $path = __DIR__ . '/pdfparser/' . str_replace('\\', '/', $class) . '.php';
        if (file_exists($path)) require_once $path;
    }
});
use Smalot\PdfParser\Parser;

// ------- Helpers -------

function getHistoryFile($username) {
    $clean = preg_replace('/[^a-zA-Z0-9_-]/', '', $username);
    if (empty($clean)) return null;
    return __DIR__ . '/../data/handicap_history_' . $clean . '.json';
}

function loadHistory($file) {
    if ($file && file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
        if (is_array($data)) return $data;
    }
    return [];
}

function saveHistory($file, $history) {
    $dir = dirname($file);
    if (!file_exists($dir)) {
        mkdir($dir, 0755, true);
        chmod($dir, 0755);
    }
    $json = json_encode($history, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    // Try with LOCK_EX first; fall back without it (some hosts don't support it)
    $ok = @file_put_contents($file, $json, LOCK_EX);
    if ($ok === false) {
        $ok = @file_put_contents($file, $json);
    }
    if ($ok !== false && file_exists($file)) {
        @chmod($file, 0644);
    }
    return $ok !== false;
}

function buildPdfUrl($license) {
    if (preg_match('/(\d+)$/', $license, $m)) {
        $shortId = ltrim(substr($m[1], -6), '0');
        return 'https://api.rfeg.es/files/summaryhandicap/' . $shortId . '.pdf';
    }
    return null;
}

function fetchPdf($url) {
    $ch = curl_init();
    $urlT = $url . (strpos($url, '?') === false ? '?' : '&') . 't=' . microtime(true);
    curl_setopt_array($ch, [
        CURLOPT_URL            => $urlT,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_USERAGENT      => "Mozilla/5.0 (compatible; GolfCalendar/1.0)",
        CURLOPT_HTTPHEADER     => ["Cache-Control: no-cache", "Pragma: no-cache"],
    ]);
    $content = curl_exec($ch);
    $code    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err     = curl_error($ch);
    curl_close($ch);
    if ($code !== 200 || !$content) {
        throw new Exception("PDF fetch failed. HTTP {$code}. {$err}");
    }
    return $content;
}

function calcBajada($history) {
    if (count($history) < 2) return 0;
    $values = array_column($history, 'handicap');
    return round(max($values) - min($values), 1);
}

/**
 * Parse handicap history from the RFEG PDF text.
 *
 * The Smalot parser outputs each row WITHOUT spaces between columns, like:
 *   122/02/2026VUELTA VALEDERA ...  1 LA ROCA  Individuales 18 69.0/119/71 5.0 3 38 0
 *   ^row number glued to date
 *
 * Strategy: Find all occurrences of the Vc/Vs/PAR pattern (e.g. 69.0/119/71)
 * then read the SMH handicap that IMMEDIATELY follows it (first number after whitespace).
 * For the date, look BACKWARDS from the Vc/Vs/PAR match to find dd/mm/yyyy.
 *
 * Block 1 boundary: text after the header table line "NUM.\nHOYOS Vc/Vs/PAR..." 
 * and before "2.  Para cada resultado"
 */
function parseHandicapHistory($text) {
    // ── 1. Isolate Block 1 ──────────────────────────────────────────────────
    // The block starts after the column header line (which contains "Vc/Vs/PAR")
    // and ends at "2." marker. Use several fallback markers.
    $searchText = $text; // default: full text

    // End marker (try with one or two spaces after "2.")
    $endCandidates = [
        "2.  Para cada resultado",
        "2. Para cada resultado",
        "2.  Para cada",
        "2. Para cada",
    ];
    $endPos = false;
    foreach ($endCandidates as $mk) {
        $p = mb_strpos($text, $mk);
        if ($p !== false) { $endPos = $p; break; }
    }

    // Start: find the column header row that contains "Vc/Vs/PAR"
    // It appears just before the first data row in block 1.
    $headerMarker = "Vc/Vs/PAR";
    $startPos = mb_strpos($text, $headerMarker);
    if ($startPos !== false) {
        // Move past the header line (find the next newline after it)
        $nl = mb_strpos($text, "\n", $startPos);
        if ($nl !== false) $startPos = $nl + 1;
    }

    if ($startPos !== false && $endPos !== false && $endPos > $startPos) {
        $searchText = mb_substr($text, $startPos, $endPos - $startPos);
    } elseif ($endPos !== false) {
        $searchText = mb_substr($text, 0, $endPos);
    }

    // ── 2. Extract entries ──────────────────────────────────────────────────
    // Pattern explanation:
    //   The row starts with a 1-2 digit row number GLUED to the date (no space).
    //   So we match: optional digits + dd/mm/yyyy
    //   Then anything/.+?/  then the Vc/Vs/PAR block
    //   Then the SMH_hcp (first decimal number after Vc/Vs/PAR)
    //   Then tournament name is between date and Vc/Vs/PAR
    //
    // We also need to capture the tournament name, which is between the date and Vc/Vs/PAR.
    // Since the row number is glued to the date, the date always starts with \d{2}/\d{2}/\d{4}.
    // We use a lookbehind-friendly approach: match the date, then lazy-match up to Vc/Vs/PAR.
    //
    // Main regex (translated and corrected from Python):
    //   (\d{2}/\d{2}/\d{4})   - date (dd/mm/yyyy)
    //   (.*?)                  - tournament name (lazy, may span newlines in edge cases)  
    //   (\d+\.\d+)/(\d+)/(\d+) - Vc/Vs/PAR
    //   \s+                    - whitespace
    //   ([+-]?\d+\.\d+)        - SMH_hcp ← the key value

    $pattern = '/(\d{2}\/\d{2}\/\d{4})(.*?)(\d+\.\d+)\/(\d+)\/(\d+)\s+([+-]?\d+\.\d+)/su';

    $entries = [];

    if (preg_match_all($pattern, $searchText, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $m) {
            $rawDate  = trim($m[1]);   // dd/mm/yyyy
            $between  = trim($m[2]);   // text between date and Vc/Vs/Par (contains torneo name)
            $hcpValue = (float) $m[6]; // SMH_hcp

            // Convert dd/mm/yyyy → YYYY-MM-DD
            $parts = explode('/', $rawDate);
            if (count($parts) !== 3) continue;
            $isoDate = sprintf('%04d-%02d-%02d', (int)$parts[2], (int)$parts[1], (int)$parts[0]);

            // Extract tournament name from the 'between' string.
            // It's: "NOMBRE DEL TORNEO  vuelta  CAMPO  modalidad  nHoyos"
            // The first token that looks like a number (vuelta) marks the end of the name.
            // Simple heuristic: take everything before the first standalone short number or tab.
            $tournName = '';
            // Remove leading/trailing whitespace and newlines
            $between = preg_replace('/\s+/', ' ', $between);
            // The tournament name is before the vuelta number + field name.
            // Try: split on first occurrence of " \d " pattern (a standalone small number = vuelta)
            if (preg_match('/^(.*?)\s+\d+\s+/u', $between, $nm)) {
                $tournName = trim($nm[1]);
            } else {
                // Fallback: first 60 chars
                $tournName = mb_substr(trim($between), 0, 60);
            }

            $entries[] = [
                'date'       => $isoDate,
                'handicap'   => $hcpValue,
                'source'     => 'rfeg_pdf',
                'tournament' => $tournName,
            ];
        }
    }

    // Sort oldest → newest
    usort($entries, fn($a, $b) => strcmp($a['date'], $b['date']));

    return $entries;
}

/**
 * Merge PDF history into existing stored history.
 *
 * Only rfeg_pdf entries are kept — old daily snapshots (entries without
 * source='rfeg_pdf') are discarded. This keeps the history clean and
 * limited to real tournament data points.
 *
 * PDF entries always win for the same date (they carry tournament name, etc.)
 */
function mergeHistories($existing, $fromPdf) {
    $byDate = [];

    // Keep existing entries ONLY if they came from rfeg_pdf
    // (discard old daily snapshots that have no source or a different source)
    foreach ($existing as $e) {
        $d   = $e['date']   ?? '';
        $src = $e['source'] ?? '';
        if ($d && $src === 'rfeg_pdf') {
            $byDate[$d] = $e;
        }
    }

    // New PDF entries always override
    foreach ($fromPdf as $e) {
        $d = $e['date'] ?? '';
        if ($d) $byDate[$d] = $e;
    }

    $merged = array_values($byDate);
    usort($merged, fn($a, $b) => strcmp($a['date'], $b['date']));

    return $merged;
}

// ─────────────────── MAIN ────────────────────

$username      = $_GET['username']      ?? '';
$passedLicense = $_GET['license']       ?? '';

if (empty($username)) {
    http_response_code(400);
    echo json_encode(['error' => 'username required']);
    exit;
}

// Build PDF URL
$pdfUrl = '';
if (!empty($passedLicense)) {
    $pdfUrl = buildPdfUrl($passedLicense) ?? '';
}
if (empty($pdfUrl)) {
    $usersFile = __DIR__ . '/users.json';
    if (file_exists($usersFile)) {
        $users = json_decode(file_get_contents($usersFile), true);
        if (isset($users[$username])) {
            $u = $users[$username];
            if (!empty($u['federation_id'])) {
                $pdfUrl = buildPdfUrl($u['federation_id']) ?? '';
            } elseif (!empty($u['handicap_url'])) {
                $pdfUrl = $u['handicap_url'];
            }
        }
    }
}

$historyFile = getHistoryFile($username);
$existing    = loadHistory($historyFile);

if (empty($pdfUrl)) {
    echo json_encode([
        'history' => $existing,
        'source'  => 'stored_only',
        'bajada'  => calcBajada($existing),
        'warning' => 'No license/PDF URL found',
    ]);
    exit;
}

try {
    $pdfContent = fetchPdf($pdfUrl);

    $parser = new Parser();
    $pdf    = $parser->parseContent($pdfContent);
    $text   = $pdf->getText();

    $fromPdf = parseHandicapHistory($text);

    if (empty($fromPdf)) {
        echo json_encode([
            'history' => $existing,
            'source'  => 'stored_only',
            'bajada'  => calcBajada($existing),
            'warning' => 'PDF parsed but no entries found in Block 1',
        ]);
        exit;
    }

    $merged = mergeHistories($existing, $fromPdf);

    if ($historyFile) {
        saveHistory($historyFile, $merged);
    }

    echo json_encode([
        'history'     => $merged,
        'source'      => 'rfeg_pdf',
        'pdf_entries' => count($fromPdf),
        'total'       => count($merged),
        'bajada'      => calcBajada($merged),
        'pdf_url'     => $pdfUrl,
    ]);

} catch (Exception $e) {
    echo json_encode([
        'history' => $existing,
        'source'  => 'stored_only',
        'bajada'  => calcBajada($existing),
        'error'   => $e->getMessage(),
    ]);
}
?>

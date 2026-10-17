<?php
header("Content-Type: text/plain");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Autoloader
spl_autoload_register(function ($class) {
    if (strpos($class, 'Smalot\\PdfParser\\') === 0) {
        $path = __DIR__ . '/pdfparser/' . str_replace('\\', '/', $class) . '.php';
        if (file_exists($path)) {
            require_once $path;
        }
    }
});

use Smalot\PdfParser\Parser;

$pdfUrl = 'https://api.rfeg.es/files/summaryhandicap/996143.pdf';
echo "Target URL: $pdfUrl\n\n";

$userAgents = [
    "None" => null,
    "Node.js" => "Node.js", // Trying to mimic Node?
    "Wget" => "Wget/1.21",
    "Curl" => "curl/7.64.1",
    "Empty" => "",
    "Chrome" => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
];

foreach ($userAgents as $name => $ua) {
    echo "\n--- TESTING UA: $name ---\n";
    checkUrl($pdfUrl, $ua);
}

function checkUrl($url, $ua) {
    $ch = curl_init();
    $urlWithTime = $url . "?t=" . microtime(true); // Cache bust
    curl_setopt($ch, CURLOPT_URL, $urlWithTime);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $headers = [
        "Cache-Control: no-cache",
        "Pragma: no-cache"
    ];
    
    if ($ua !== null) {
        curl_setopt($ch, CURLOPT_USERAGENT, $ua);
    } else {
        // To strictly send NO UA, we might need to set it to empty string or remove it?
        // Curl sends a default one usually.
        // Let's try explicitly setting empty if null is passed?
        // Actually curl_setopt(CURLOPT_USERAGENT, "") sends empty UA.
        // If we don't set it, it sends "curl/x.y.z".
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $content = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    if ($content) {
        echo "HTTP Code: " . $info['http_code'] . "\n";
        echo "Size: " . strlen($content) . " bytes\n";
        echo "MD5: " . md5($content) . "\n";
        
        try {
            $parser = new Parser();
            $pdf = $parser->parseContent($content);
            $text = $pdf->getText();
            
            // Find Date
            if (preg_match('/FECHA[:\s]*(\d{2}\/\d{2}\/\d{4})/', $text, $dMatch)) {
                echo "Date: " . $dMatch[1] . "\n";
            } else {
                echo "Date: Not Found\n";
            }

            // Find Handicap
            if (preg_match('/NUEVO\s+H[AÁ]NDICAP\s*:\s*([\d\.]+)/iu', $text, $matches)) {
                echo "Handicap: " . $matches[1] . "\n";
            } else {
                echo "Handicap: Not Found\n";
            }

        } catch (Exception $e) {
            echo "Parse Error: " . $e->getMessage() . "\n";
        }
    } else {
        echo "Failed to fetch.\n";
    }
}
?>

<?php
/**
 * ONE-TIME cleanup script.
 * Removes all non-rfeg_pdf entries from every handicap_history_*.json file.
 * DELETE this file after running.
 */
header("Content-Type: text/plain; charset=utf-8");

$dataDir = __DIR__ . '/../data';

if (!is_dir($dataDir)) {
    die("data/ directory not found at: $dataDir");
}

$files = glob($dataDir . '/handicap_history_*.json');

if (empty($files)) {
    die("No handicap_history_*.json files found in $dataDir");
}

echo "Found " . count($files) . " file(s):\n\n";

foreach ($files as $file) {
    $basename = basename($file);
    $raw      = file_get_contents($file);
    $data     = json_decode($raw, true);

    if (!is_array($data)) {
        echo "⚠️  $basename — could not parse JSON, skipping\n";
        continue;
    }

    $before = count($data);
    // Keep only rfeg_pdf entries
    $clean  = array_values(array_filter($data, fn($e) => ($e['source'] ?? '') === 'rfeg_pdf'));
    $after  = count($clean);
    $removed = $before - $after;

    if ($removed === 0) {
        echo "✅  $basename — already clean ($before entries, nothing removed)\n";
        continue;
    }

    // Save cleaned version
    $ok = file_put_contents($file, json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($ok !== false) {
        echo "🧹  $basename — removed $removed daily snapshot(s), kept $after RFEG entries\n";
    } else {
        echo "❌  $basename — failed to write cleaned file\n";
    }
}

echo "\nDone. You can now delete cleanup_history.php from the server.\n";
?>

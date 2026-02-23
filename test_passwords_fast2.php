<?php
$users = json_decode(file_get_contents(__DIR__ . '/public/api/users.json'), true);

foreach (['nicole' => 'nicole', 'txell' => 'alos', 'jordi' => 'Reinaldo', 'jordi2' => 'jordi'] as $u => $p) {
    if ($u === 'jordi2') $u = 'jordi';
    
    $hash = $users[$u]['password_hash'] ?? null;
    if ($hash) {
        $cands = [$p, strtolower($p), ucfirst(strtolower($p))];
        $found = false;
        foreach ($cands as $c) {
             if (password_verify($c, $hash)) {
                  echo "$u : $c\n";
                  $found = true;
                  break;
             }
        }
        if (!$found) echo "$u : NOT $p\n";
    }
}

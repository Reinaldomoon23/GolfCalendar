<?php
$users = json_decode(file_get_contents(__DIR__ . '/public/api/users.json'), true);

foreach (['nicole' => '1234', 'jordi' => '1234', 'jordi2' => '123456', 'jordi3' => 'admin', 'jordi4' => 'password'] as $u => $p) {
    if (strpos($u, 'jordi') !== false) $u = 'jordi';
    
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
    }
}

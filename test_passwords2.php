<?php
$users = json_decode(file_get_contents(__DIR__ . '/public/api/users.json'), true);
$common_surnames = [
    'Likhomanova', 'likhomanova', 'Alo\'s', 'Alós', 'alos', 'Alos', 'Martinez', 'martinez', 'cucco', 'Cucco', 
    'corretja', 'Corretja', 'demiguel', 'Demiguel', 'boixader', 'Boixader', 'montolio', 'Montolio', 
    'jordi', 'Jordi', 'Reinaldo', 'reinaldo', '1234', '123456', 'password'
];

foreach ($users as $username => $u) {
    if (!isset($u['password_hash'])) {
        echo "$username : [NO PASSWORD HASH STORED]\n";
        continue;
    }
    $hash = $u['password_hash'];
    $found = false;
    
    // Test username
    if (password_verify($username, $hash)) { echo "$username : $username\n"; $found = true; continue; }
    if (password_verify(ucfirst($username), $hash)) { echo "$username : " . ucfirst($username) . "\n"; $found = true; continue; }

    // Test surnames
    foreach ($common_surnames as $s) {
        if (password_verify($s, $hash)) {
            echo "$username : $s\n";
            $found = true; break;
        }
    }
    
    // Extract pieces of full_name
    if (!$found && isset($u['full_name'])) {
        $parts = explode(' ', strtolower($u['full_name']));
        foreach ($parts as $p) {
            if (password_verify($p, $hash) || password_verify(ucfirst($p), $hash)) {
                echo "$username : $p (or capitalized)\n";
                $found = true; break;
            }
        }
    }
    
    if (!$found) {
        echo "$username : [UNKNOWN]\n";
    }
}

<?php
$users = json_decode(file_get_contents(__DIR__ . '/public/api/users.json'), true);
$test_passwords = ['likhomanova', 'Likhomanova', 'nicole', 'Nicole', 'alos', 'Alos', 'Alós', 'txell', 'Txell', 'martinez', 'Martinez', 'cucco', 'Cucco', 'ona', 'Ona', 'corretja', 'Corretja', 'demiguel', 'valentina', 'Valentina', 'boixader', 'Boixader', 'maria', 'Maria', 'sofia', 'Sofia', 'david', 'David', 'montolio', 'Montolio', 'adriana', 'Adriana', 'jordi', 'Jordi', 'Reinaldo'];

foreach ($users as $username => $data) {
    if (!isset($data['password_hash'])) continue;
    $hash = $data['password_hash'];
    $found = false;
    foreach ($test_passwords as $p) {
        if (password_verify($p, $hash)) {
            echo "$username : $p\n";
            $found = true;
            break;
        }
    }
    if (!$found) {
        // try username 
        if (password_verify($username, $hash)) {
            echo "$username : $username\n";
        } else if (password_verify(ucfirst($username), $hash)) {
            echo "$username : " . ucfirst($username) . "\n";
        } else {
            echo "$username : UNKNOWN\n";
        }
    }
}

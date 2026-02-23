<?php
$users = json_decode(file_get_contents('public/api/users.json'), true);
if (!$users) {
    echo "JSON decode failed: " . json_last_error_msg();
    exit;
}

$u = 'jordi';
$p = 'DanzigXtothec23$';

if (!isset($users[$u])) {
    echo "User $u not found in users.json";
    print_r(array_keys($users));
    exit;
}

$hash = $users[$u]['password_hash'];
echo "Hash found: $hash\n";

if (password_verify($p, $hash)) {
    echo "SUCCESS: Password matches.";
} else {
    echo "FAIL: Password does not match.";
}
?>

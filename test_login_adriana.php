<?php
$username = 'adriana';
$password = 'montolio'; // Lowercase

$usersFile = './public/api/users.json';

if (!file_exists($usersFile)) {
    echo "Error: users.json NOT found at $usersFile\n";
    exit(1);
}

$content = file_get_contents($usersFile);
$users = json_decode($content, true);

if (!$users) {
    echo "Error: JSON decode failed\n";
    exit(1);
}

if (!isset($users[$username])) {
    echo "Error: User '$username' not found in users.json\n";
    echo "Available users: " . implode(', ', array_keys($users)) . "\n";
    exit(1);
}

$user = $users[$username];
echo "User found. Testing password verify...\n";

if (password_verify($password, $user['password_hash'])) {
    echo "SUCCESS: Login valid for '$username'\n";
} else {
    echo "FAILURE: Password incorrect for '$username'\n";
    echo "Hash stored: " . $user['password_hash'] . "\n";
    // Debug: generate new hash
    echo "Expected hash for '$password': " . password_hash($password, PASSWORD_DEFAULT) . "\n";
}
?>

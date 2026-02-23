<?php
$usersFile = __DIR__ . '/public/api/users.json';

if (!file_exists($usersFile)) {
    echo "Error: users.json not found at $usersFile\n";
    // Try to find it in api/ directly if running from root
    $usersFile = __DIR__ . '/api/users.json';
    if (!file_exists($usersFile)) {
         echo "Error: users.json not found at $usersFile either\n";
         exit(1);
    }
}

$users = json_decode(file_get_contents($usersFile), true);

// Create new user
$username = 'adriana';
$password = 'montolio'; // Lowercase as requested
$hash = password_hash($password, PASSWORD_DEFAULT);

$users[$username] = [
    'username' => $username,
    'password_hash' => $hash,
    'full_name' => 'Adriana Montolio',
    'role' => 'user',
    'federation_id' => '', // Empty for now
    'handicap' => '',
    'photo_url' => 'profile.jpg'
];

if (file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT))) {
    echo "User 'adriana' added successfully to $usersFile\n";
    echo "Hash: $hash\n";
} else {
    echo "Error writing to users.json\n";
    exit(1);
}
?>

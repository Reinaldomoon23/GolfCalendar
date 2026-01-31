<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$data = json_decode(file_get_contents('php://input'), true);
$username = strtolower(trim($data['username'] ?? ''));
$password = $data['password'] ?? '';
$fullName = $data['full_name'] ?? '';
$federationId = trim($data['federation_id'] ?? '');

if (!$username || !$password || !$fullName) {
    http_response_code(400);
    echo json_encode(['error' => 'Username, password and full name are required']);
    exit;
}

// Basic validation
if (!preg_match('/^[a-z0-9_-]{3,20}$/', $username)) {
    http_response_code(400);
    echo json_encode(['error' => 'Username must be 3-20 characters (letters, numbers, underscores, hyphens)']);
    exit;
}

$usersFile = __DIR__ . '/users.json';
$users = [];
if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?: [];
}

if (isset($users[$username])) {
    http_response_code(409);
    echo json_encode(['error' => 'Username already exists']);
    exit;
}

// Create new user entry
$users[$username] = [
    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    'full_name' => $fullName,
    'federation_id' => $federationId,
    'photo_url' => 'profiles/' . $username . '.jpg',
    'handicap_url' => ''
];

if (file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT))) {
    // Return user without password
    $newUser = $users[$username];
    unset($newUser['password_hash']);
    $newUser['username'] = $username;
    
    echo json_encode(['success' => true, 'user' => $newUser]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save user database']);
}
?>

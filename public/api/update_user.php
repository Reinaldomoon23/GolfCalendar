<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$data = json_decode(file_get_contents('php://input'), true);
$username = strtolower(trim($data['username'] ?? ''));
$fullName = $data['full_name'] ?? '';
$federationId = trim($data['federation_id'] ?? '');
$email = trim($data['email'] ?? '');

if (!$username) {
    http_response_code(400);
    echo json_encode(['error' => 'Username is required']);
    exit;
}

$usersFile = __DIR__ . '/users.json';
if (!file_exists($usersFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'User database not found']);
    exit;
}

$users = json_decode(file_get_contents($usersFile), true) ?: [];

if (!isset($users[$username])) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
}

// Update fields
if ($fullName) {
    $users[$username]['full_name'] = $fullName;
}
if (isset($data['photo_url'])) {
    $users[$username]['photo_url'] = $data['photo_url'];
}
$users[$username]['federation_id'] = $federationId;
if ($email !== null) { // Keep existing logic where null check might be useful, but trim converts to string.
    $users[$username]['email'] = $email;
}

if (file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT))) {
    $updatedUser = $users[$username];
    unset($updatedUser['password_hash']);
    $updatedUser['username'] = $username;
    
    echo json_encode(['success' => true, 'user' => $updatedUser]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update user database']);
}
?>

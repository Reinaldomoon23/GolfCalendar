<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$data = json_decode(file_get_contents('php://input'), true);
$username = strtolower($data['username'] ?? '');
$password = $data['password'] ?? '';

if (!$username || !$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Username and password required']);
    exit;
}

$usersFile = __DIR__ . '/users.json';
if (!file_exists($usersFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'User database not found']);
    exit;
}

$users = json_decode(file_get_contents($usersFile), true);

if (isset($users[$username])) {
    $user = $users[$username];
    if (password_verify($password, $user['password_hash'])) {
        // Remove sensitive data
        unset($user['password_hash']);
        $user['username'] = $username;
        
        echo json_encode(['success' => true, 'user' => $user]);
        exit;
    }
}

http_response_code(401);
echo json_encode(['error' => 'Invalid credentials']);
?>

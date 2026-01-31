<?php
// Test Auth and Data Saving (CLI Version)

function test_login($username, $password) {
    // CMD with ENV vars
    $cmd = "REQUEST_METHOD=POST php public/api/login.php";
    
    $descriptor = [
        0 => ["pipe", "r"],
        1 => ["pipe", "w"],
        2 => ["pipe", "w"]
    ];
    
    // We need to set ENV vars in proc_open
    $env = array_merge($_SERVER, ['REQUEST_METHOD' => 'POST']);

    $process = proc_open('php public/api/login.php', $descriptor, $pipes, null, $env);
    
    if (is_resource($process)) {
        fwrite($pipes[0], json_encode(['username' => $username, 'password' => $password]));
        fclose($pipes[0]);
        
        $output = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);
        return $output;
    }
    return "Error";
}

echo "Testing Login (Success)...\n";
$res = test_login('nicole', '1234');
echo "Login Result: " . $res . "\n";

if (strpos($res, 'success') !== false) {
    echo "✅ Login Correct\n";
} else {
    echo "❌ Login Failed\n";
}

echo "Testing Login (Fail)...\n";
$res = test_login('nicole', 'wrong');
echo "Login Wrong Result: " . $res . "\n";
if (strpos($res, 'Invalid credentials') !== false) {
    echo "✅ Login Incorrect Handled\n";
} else {
    echo "❌ Login Incorrect Failed\n";
}

?>

<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $username = $_POST['username'] ?? null;
        if (!$username) {
            http_response_code(400);
            echo json_encode(["message" => "Username required"]);
            exit;
        }

        $fileTmpPath = $_FILES['file']['tmp_name'];
        $fileName = $_FILES['file']['name'];
        $fileSize = $_FILES['file']['size'];
        $fileType = $_FILES['file']['type'];
        $fileNameCmps = explode(".", $fileName);
        $fileExtension = strtolower(end($fileNameCmps));

        // Allowed extensions
        $allowedfileExtensions = array('jpg', 'gif', 'png', 'jpeg', 'webp');

        if (in_array($fileExtension, $allowedfileExtensions)) {
            // Target path: profiles folder in public
            $uploadFileDir = '../profiles/';
            if (!file_exists($uploadFileDir)) {
                mkdir($uploadFileDir, 0777, true);
            }
            
            // Sanitize username
            $clean_username = preg_replace('/[^a-zA-Z0-9_-]/', '', $username);
            $new_filename = $clean_username . '_' . time() . '.jpg';
            $dest_path = $uploadFileDir . $new_filename;

            if(move_uploaded_file($fileTmpPath, $dest_path)) {
                echo json_encode([
                    "message" => "File is successfully uploaded.",
                    "url" => "profiles/" . $new_filename,
                    "timestamp" => time()
                ]);
            } else {
                http_response_code(500);
                echo json_encode(["message" => "There was some error moving the file to upload directory."]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["message" => "Upload failed. Allowed file types: " . implode(',', $allowedfileExtensions)]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["message" => "No file uploaded or upload error.", "error" => $_FILES['file']['error'] ?? 'Unknown']);
    }
} else {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed."]);
}
?>

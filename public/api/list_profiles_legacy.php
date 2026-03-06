<?php
$dir = "../../Nicole26/profiles";
if (is_dir($dir)) {
    $files = scandir($dir);
    echo json_encode(["status" => "ok", "files" => $files]);
} else {
    echo json_encode(["status" => "error", "message" => "profiles folder in Nicole26 not found"]);
}
?>

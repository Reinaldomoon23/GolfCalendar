<?php
// Configuración de la nueva URL
$newUrl = "https://golf-calendar-v3.vercel.app";

// Redirección 301 (Movido permanentemente)
header("HTTP/1.1 301 Moved Permanently");
header("Location: $newUrl");

echo "Redireccionando a <a href='$newUrl'>$newUrl</a>...";
exit;
?>

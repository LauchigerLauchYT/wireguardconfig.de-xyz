<?php
session_start();
header('Content-Type: application/json');

try {
    if (isset($_SESSION['timestamp'])) {
        $timestamp = $_SESSION['timestamp'];
        $files = glob("downloads/*_$timestamp.*"); // Get all files with the specific timestamp
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file); // Delete the file
            }
        }
        echo json_encode(["success" => true, "message" => "Configurations cleared"]);
    } else {
        throw new Exception("No configurations to clear");
    }
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
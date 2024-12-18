<?php
session_start();
header('Content-Type: application/json');

try {
    // Log incoming data for debugging purposes
    $rawInput = file_get_contents('php://input');
    file_put_contents('php://stderr', "Raw Input: " . $rawInput . "\n");

    if ($_SERVER["REQUEST_METHOD"] == "POST") {
        // Read JSON data from the request body
        $inputData = json_decode($rawInput, true);

        // Check if JSON data was decoded correctly
        if ($inputData === null) {
            throw new Exception("Invalid JSON data");
        }

        // Ensure all required fields are present in the JSON
        $serverHost = isset($inputData['serverHost']) ? $inputData['serverHost'] : '';
        $serverPort = isset($inputData['serverPort']) ? $inputData['serverPort'] : '';
        $vpnCIDR = isset($inputData['vpnCIDR']) ? $inputData['vpnCIDR'] : '';
        $dns = isset($inputData['dns']) ? $inputData['dns'] : '';
        $allowedIPs = isset($inputData['allowedIPs']) ? $inputData['allowedIPs'] : '';
        $numClients = isset($inputData['numClients']) ? (int)$inputData['numClients'] : 1;
        $mtu = isset($inputData['mtu']) ? $inputData['mtu'] : '';

        // If a required field is missing, return an error message
        if (empty($serverHost) || empty($serverPort) || empty($vpnCIDR) || empty($allowedIPs) || empty($mtu)) {
            throw new Exception("Missing required parameters");
        }

        // Function to validate CIDR notation
        function isValidCIDR($cidr) {
            $parts = explode('/', $cidr);
            if (count($parts) != 2) {
                return false;
            }
            $ip = $parts[0];
            $mask = $parts[1];
            if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                return false;
            }
            if (!is_numeric($mask) || $mask < 0 || $mask > 32) {
                return false;
            }
            return true;
        }

        // Validate VPN CIDR
        if (!isValidCIDR($vpnCIDR)) {
            throw new Exception("Invalid VPN CIDR");
        }

        // Function to generate a WireGuard-compatible key pair
        function generateWireGuardKeyPair() {
            $keypair = sodium_crypto_box_keypair();
            $privateKey = sodium_crypto_box_secretkey($keypair);
            $publicKey = sodium_crypto_box_publickey($keypair);
            return [
                'privateKey' => base64_encode($privateKey),
                'publicKey' => base64_encode($publicKey)
            ];
        }

        // Function to generate the IP address
        function generateIPAddress($baseCIDR, $index) {
            list($baseIP, $cidr) = explode('/', $baseCIDR);
            $baseIPParts = explode('.', $baseIP);
            $baseIPParts[3] = $index;
            return implode('.', $baseIPParts) . '/' . $cidr;
        }

        // Generate server and client key pairs
        $serverKeys = generateWireGuardKeyPair();
        $serverPrivateKey = $serverKeys['privateKey'];
        $serverPublicKey = $serverKeys['publicKey'];

        // Create server configuration
        $serverAddress = generateIPAddress($vpnCIDR, 1);
        $serverConfig = "[Interface]
Address = $serverAddress
ListenPort = $serverPort
PrivateKey = $serverPrivateKey
MTU = $mtu";

        $timestamp = time();
        $_SESSION['timestamp'] = $timestamp; // Store the timestamp in the session
        $serverFile = "downloads/server_config_$timestamp.conf";
        $clientFiles = [];
        $clientConfigs = [];

        for ($i = 1; $i <= $numClients; $i++) {
            $clientKeys = generateWireGuardKeyPair();
            $clientPrivateKey = $clientKeys['privateKey'];
            $clientPublicKey = $clientKeys['publicKey'];

            $clientAddress = generateIPAddress($vpnCIDR, $i + 1);
            $clientConfig = "[Interface]
Address = $clientAddress
PrivateKey = $clientPrivateKey";

            if (!empty($dns)) {
                $clientConfig .= "\nDNS = $dns";
            }

            $clientConfig .= "\nMTU = $mtu

[Peer]
Endpoint = $serverHost:$serverPort
PublicKey = $serverPublicKey
AllowedIPs = $allowedIPs
PersistentKeepalive = 25";

            $clientFile = "downloads/client_config_{$i}_$timestamp.conf";
            file_put_contents($clientFile, $clientConfig);
            $clientFiles[] = $clientFile;
            $clientConfigs[] = $clientConfig;

            // Add the client peer to the server configuration
            $serverConfig .= "\n\n[Peer]
PublicKey = $clientPublicKey
AllowedIPs = $clientAddress";
        }

        file_put_contents($serverFile, $serverConfig);

        // Create ZIP archive
        $zipFile = "downloads/configs_$timestamp.zip";
        $zip = new ZipArchive();
        if ($zip->open($zipFile, ZipArchive::CREATE) === TRUE) {
            $zip->addFile($serverFile, basename($serverFile));
            foreach ($clientFiles as $file) {
                $zip->addFile($file, basename($file));
            }
            $zip->close();
        } else {
            throw new Exception("Error creating ZIP file");
        }

        // Successful response with file names and configurations
        echo json_encode([
            "success" => true,
            "serverFile" => $serverFile,
            "serverConfig" => $serverConfig,
            "clientFiles" => $clientFiles,
            "clientConfigs" => $clientConfigs,
            "zipFile" => $zipFile
        ]);
    } else {
        // Missing POST request
        throw new Exception("Invalid request");
    }
} catch (Exception $e) {
    // Error handling and return a JSON error message
    file_put_contents('php://stderr', "Error: " . $e->getMessage() . "\n");
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
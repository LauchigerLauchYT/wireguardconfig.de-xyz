// Function to generate the configuration
function generateConfig(event) {
    event.preventDefault(); // Prevent default form behavior

    const numClients = document.getElementById('numClients').value;
    const serverHost = document.getElementById('serverHost').value;
    const serverPort = document.getElementById('serverPort').value;
    const vpnCIDR = document.getElementById('vpnCIDR').value;
    const dnsCheckbox = document.getElementById('dnsCheckbox').checked;
    const dns = dnsCheckbox ? document.getElementById('dns').value : '';
    const allowedIPs = document.getElementById('allowedIPs').value;
    const mtu = document.getElementById('mtu').value;

    // Create the data as JSON
    const data = {
        serverHost: serverHost,
        serverPort: serverPort,
        vpnCIDR: vpnCIDR,
        dns: dns,
        allowedIPs: allowedIPs,
        numClients: numClients,
        mtu: mtu
    };

    // Send AJAX request to the backend
    fetch('generate_config.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data) // Send the data as JSON
    })
        .then((response) => response.json()) // Process JSON response
        .then((data) => {
            if (data.success) {
                displayConfigAndQrCode(data);
            } else {
                showAlert('Dein CIDR ist falsch!');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('An error occurred!');
        });
}

document.getElementById('configForm').addEventListener('submit', generateConfig);

function displayConfigAndQrCode(data) {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = ""; // Clear previous contents

    // Display server configuration
    const serverSection = document.createElement('div');
    serverSection.classList.add('config-section');
    const serverTitle = document.createElement('h2');
    serverTitle.textContent = 'Server Configuration';

    const serverConfigCard = document.createElement('div');
    serverConfigCard.classList.add('card');
    serverConfigCard.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center">
            <span>Server Configuration</span>
            <div>
                <button class="btn btn-outline-secondary btn-sm" onclick="copyToClipboard('#serverConfig'); return false;">Kopieren</button>
                <a href="${data.serverFile}" class="btn btn-outline-secondary btn-sm" download>Download</a>
            </div>
        </div>
        <div class="card-body d-flex">
            <pre><code id="serverConfig" class="language-html">${data.serverConfig}</code></pre>
        </div>
    `;

    serverSection.appendChild(serverTitle);
    serverSection.appendChild(serverConfigCard);
    outputDiv.appendChild(serverSection);

    // Display client configurations and generate QR codes
    data.clientFiles.forEach((file, index) => {
        const clientSection = document.createElement('div');
        clientSection.classList.add('config-section');
        const clientTitle = document.createElement('h2');
        clientTitle.textContent = `Client ${index + 1} Configuration`;

        const clientConfigCard = document.createElement('div');
        clientConfigCard.classList.add('card');
        clientConfigCard.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>Client ${index + 1} Configuration</span>
                <div>
                    <button class="btn btn-outline-secondary btn-sm" onclick="copyToClipboard('#clientConfig${index}'); return false;">Kopieren</button>
                    <a href="${file}" class="btn btn-outline-secondary btn-sm" download>Download</a>
                </div>
            </div>
            <div class="card-body d-flex justify-content-between align-items-stretch">
                <pre><code id="clientConfig${index}" class="language-html">${data.clientConfigs[index]}</code></pre>
                <div id="qrcode-${index}" class="qrcode"></div>
            </div>
        `;

        clientSection.appendChild(clientTitle);
        clientSection.appendChild(clientConfigCard);
        outputDiv.appendChild(clientSection);

        // Generate QR code after appending elements to the DOM
        new QRCode(document.getElementById(`qrcode-${index}`), {
            text: window.location.origin + "/" + file,
            width: 128,
            height: 128,
        });
    });

    // Add download all button
    const downloadAllButton = document.createElement('button');
    downloadAllButton.innerHTML = '<img src="assets/icons/download.png" alt="Download" class="icon"> Download All Configurations';
    downloadAllButton.onclick = () => {
        window.location.href = data.zipFile;
    };
    outputDiv.appendChild(downloadAllButton);
}

// Function to copy text to clipboard
function copyToClipboard(elementId) {
    const text = document.querySelector(elementId).textContent;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

// Function to update client count display
function updateClientCount(value) {
    document.getElementById('clientCountDisplay').textContent = value;
}

// Function to toggle DNS input visibility
function toggleDnsInput() {
    const dnsInput = document.getElementById('dns');
    const dnsCheckbox = document.getElementById('dnsCheckbox');
    if (dnsCheckbox.checked) {
        dnsInput.style.display = 'block';
        dnsInput.setAttribute('required', 'required');
    } else {
        dnsInput.style.display = 'none';
        dnsInput.removeAttribute('required');
    }
}

// Load dark mode preference on page load
window.addEventListener('DOMContentLoaded', (event) => {
    toggleDnsInput(); // Ensure DNS input visibility is correct on page load
});

// Function to show alert with a message
function showAlert(message) {
    const alertDiv = document.createElement('div');
    alertDiv.classList.add('alert');
    alertDiv.innerHTML = `
        <div class="alert-content">
            <img src="assets/icons/warning.gif" alt="Warning" style="width: 50px; height: 50px; margin-bottom: 10px;">
            <p>${message}</p>
            <button onclick="closeAlert()">OK</button>
            <button onclick="clearForm()">Clear</button>
        </div>
    `;
    document.body.appendChild(alertDiv);
}

// Function to close the alert
function closeAlert() {
    const alertDiv = document.querySelector('.alert');
    if (alertDiv) {
        document.body.removeChild(alertDiv);
    }
}

// Function to clear the form and delete generated configurations
function clearForm() {
    document.getElementById('configForm').reset();
    fetch('clear_config.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.success) {
            console.log(data.message);
            document.getElementById('output').innerHTML = ""; // Clear the output div
        } else {
            console.error(data.message);
        }
    })
    .catch((error) => {
        console.error('Error:', error);
    });
    closeAlert();
}

document.getElementById('clearFormButton').addEventListener('click', clearForm);
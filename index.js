const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');

// Function to check if the response is considered UP or DOWN
function isUp(response) {
    return response.status >= 200 && response.status < 300 && response.data && response.data.latency < 500;
}

// Function to check the health of an endpoint
async function checkEndpointHealth(endpoint) {
    const startTimestamp = Date.now();
    try {
        const { method = 'GET', url, headers = {}, body } = endpoint;
        const response = await axios({
            method,
            url,
            headers,
            data: body,
        });
        const latency = Date.now() - startTimestamp;

        // Determine if the outcome is UP or DOWN
        const status = isUp(response) ? 'UP' : 'DOWN';

        return { status, latency };
    } catch (error) {
        return { status: 'DOWN' };
    }
}

// Main function to monitor endpoints
async function monitorEndpoints(filePath) {
    try {
        // Read YAML configuration file
        const endpoints = yaml.load(fs.readFileSync(filePath, 'utf8'));

        // Initialize availability tracking object
        const availability = {};

        // Function to log availability percentages
        function logAvailability() {
            console.log('\nAvailability percentages:');
            for (const domain in availability) {
                const totalRequests = availability[domain].total;
                const successfulRequests = availability[domain].successful;
                const percentage = Math.round((successfulRequests / totalRequests) * 100) || 0;
                console.log(`${domain} has ${percentage}% availability percentage`);
            }
        }

        // Schedule tests every 15 seconds
        const interval = setInterval(async () => {
            console.log('\nTesting endpoints...');
            for (const endpoint of endpoints) {
                const result = await checkEndpointHealth(endpoint);

                // Update availability tracking
                const domain = new URL(endpoint.url).hostname;
                availability[domain] = availability[domain] || { total: 0, successful: 0 };
                availability[domain].total++;
                if (result.status === 'UP') {
                    availability[domain].successful++;
                }

                console.log(`${endpoint.name} (${endpoint.url}): ${result.status} (${result.latency || 'N/A'} ms)`);
            }
        }, 15000); // 15 seconds in milliseconds

        // Listen for CTRL+C to exit
        process.on('SIGINT', () => {
            clearInterval(interval);
            console.log('\nMonitoring interrupted.');
            logAvailability(); // Log final availability before exit
            process.exit();
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Accept the file path as a command-line argument
const filePath = process.argv[2];

// Start monitoring endpoints
monitorEndpoints(filePath);
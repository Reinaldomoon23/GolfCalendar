const pdf = require('pdf-parse');
const https = require('https');

const pdfUrl = 'https://api.rfeg.es/files/summaryhandicap/996143.pdf';

function downloadPDF(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch PDF: ${res.statusCode} ${res.statusMessage}`));
                return;
            }

            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', (err) => reject(err));
    });
}

async function main() {
    try {
        const buffer = await downloadPDF(pdfUrl);
        const data = await pdf(buffer);

        console.log("--- START OF TEXT ---");
        console.log(data.text);
        console.log("--- END OF TEXT ---");

        const regex = /NUEVO\s+H[AÁ]NDICAP\s*:\s*([\d\.]+)/gi;
        const matches = [...data.text.matchAll(regex)];

        console.log("\n--- MATCHES FOUND ---");
        matches.forEach((m, i) => {
            console.log(`Match ${i + 1}: ${m[0]} (Value: ${m[1]})`);
        });

    } catch (error) {
        console.error(error);
    }
}

main();

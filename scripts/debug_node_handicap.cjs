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
        console.log("Fetching PDF from:", pdfUrl);
        const buffer = await downloadPDF(pdfUrl);
        console.log("PDF downloaded, size:", buffer.length);
        const data = await pdf(buffer);

        console.log("\n--- NODE EXTRACTED TEXT START ---");
        console.log(data.text);
        console.log("--- NODE EXTRACTED TEXT END ---\n");

        const regex = /NUEVO\s+H[AÁ]NDICAP\s*:\s*([\d\.]+)/i;
        const match = data.text.match(regex);

        if (match && match[1]) {
            console.log("MATCH FOUND:", match[1]);
        } else {
            console.log("NO MATCH FOUND");
        }

    } catch (error) {
        console.error(error);
    }
}

main();

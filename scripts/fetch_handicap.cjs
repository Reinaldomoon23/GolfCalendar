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

        const regex = /NUEVO\s+H[AÁ]NDICAP\s*:\s*([\d\.]+)/gi;
        const matches = [...data.text.matchAll(regex)];

        if (matches.length > 0) {
            // Get the LAST match, as it likely represents the final calculated handicap
            // in case the PDF contains a history list or multiple entries.
            const lastMatch = matches[matches.length - 1];
            const handicap = lastMatch[1];

            if (matches.length > 1) {
                console.error(`Warning: Found ${matches.length} matches for handicap. Using the last one: ${handicap}`);
            }

            console.log(JSON.stringify({ handicap: handicap }));
        } else {
            console.error("Handicap not found in PDF text.");
            console.log(JSON.stringify({ error: "Handicap not found" }));
            process.exit(1);
        }

    } catch (error) {
        console.error(error);
        console.log(JSON.stringify({ error: error.message }));
        process.exit(1);
    }
}

main();

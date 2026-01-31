const puppeteer = require('puppeteer');
const fs = require('fs');

// Receive course name as argument
const courseName = process.argv[2] || "Augusta National Golf Club";

console.log(`🏌️ Buscando tarjeta para: ${courseName} en WIKIPEDIA...`);

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        // Strategy: Search via DuckDuckGo looking for Wikipedia
        console.log("🔍 Buscando en Wikipedia...");
        const searchQuery = `site:wikipedia.org "${courseName}" scorecard par`;
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        // Get the first result link
        const firstLink = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('.result__a, a'));
            return anchors.find(a => a.href.includes('wikipedia.org'))?.href || null;
        });

        if (!firstLink) {
            console.error("❌ No se encontró ningún artículo de Wikipedia.");
            await browser.close();
            return;
        }

        console.log(`🔗 Enlace encontrado: ${firstLink}`);

        await page.goto(firstLink, { waitUntil: 'domcontentloaded' });

        // Parse Wikipedia Scorecard Table
        const tableData = await page.evaluate(() => {
            const result = {};
            // Wikipedia scorecards usually have "Hole" in headers and "Par" rows
            const tables = Array.from(document.querySelectorAll('table.wikitable, table'));

            for (const table of tables) {
                // Check if this table looks like a scorecard (has 18 holes mentioned or structure)
                // Look for a row with "Par"
                const rows = Array.from(table.querySelectorAll('tr'));
                const parRow = rows.find(r => r.innerText.includes('Par') && !r.innerText.includes('Parent'));

                if (parRow) {
                    const cells = Array.from(parRow.querySelectorAll('th, td'));
                    // Extract numbers. Wikipedia often has totals like "36" or "72", we want single digit pars mostly (3-5), maybe 6.
                    // But typically a scorecard row is: "Par" 4 5 4 ... 36 ... 72
                    // We try to grab the first 18 valid par numbers (3-6)
                    const nums = cells.map(c => parseInt(c.innerText.trim()))
                        .filter(n => !isNaN(n) && n >= 3 && n <= 6);

                    if (nums.length >= 18) { // We found enough for 18 holes
                        result.pars = nums.slice(0, 18);
                        result.found = true;
                        break;
                    } else if (nums.length >= 9) {
                        // Maybe it's a 9 hole table or split
                        result.pars = nums;
                        result.partial = true;
                        // Don't break yet, look for a better one
                    }
                }
            }
            if (!result.found && !result.partial) result.error = "No scorecard table found in Wikipedia article";
            return result;
        });

        if (tableData && tableData.pars && tableData.pars.length >= 9) {
            console.log("\n✅ ¡Tarjeta ENCONTRADA en Wikipedia!");
            console.log("-----------------------");
            console.log(JSON.stringify(tableData.pars));
            console.log("-----------------------");
            console.log(`Holes found: ${tableData.pars.length}`);
            console.log(`Total Par: ${tableData.pars.reduce((a, b) => a + b, 0)}`);

            fs.writeFileSync('temp_scraped_pars.json', JSON.stringify({ name: courseName, pars: tableData.pars }, null, 2));

        } else {
            console.log("⚠️ No se encontró tabla de tarjeta en Wikipedia.");
        }

    } catch (error) {
        console.error("Error durante el scraping:", error);
    } finally {
        await browser.close();
    }
})();

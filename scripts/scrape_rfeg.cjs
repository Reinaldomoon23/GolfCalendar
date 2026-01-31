const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../src/data/scraped_courses.json');
const BASE_URL = 'https://rfegolf.es/clubes';

async function main() {
    console.log("🚀 Starting Automated RFEG Scraper...");
    console.log("📦 Output file: " + OUTPUT_FILE);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: "new", // Run in background
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set User Agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    let allClubs = [];

    try {
        // --- STEP 1: GATHER CLUB URLs ---
        console.log("\n📡 Phase 1: Scanning Club List...");

        // We will execute a search for clubs with 9+ holes.
        // Since URL params for filters are not obvious, we will apply filters on page 1
        // and then assume the session keeps them, OR just scrape everything and filter by data later.
        // To be safe, let's just scrape everything. Pagination is easier via URL.

        let pageNum = 1;
        let emptyPagesCount = 0;

        while (true) {
            const listUrl = `${BASE_URL}?page=${pageNum}&view=card&entity-type=rfeg`;
            process.stdout.write(`   Scanning Page ${pageNum}... `);

            try {
                await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Extract Clubs on this page
                const clubsOnPage = await page.evaluate(() => {
                    const cards = Array.from(document.querySelectorAll('.club-card, .maps-list-item, div.card'));
                    return cards.map(c => {
                        const link = c.querySelector('a');
                        const titleEl = c.querySelector('.club-card__title, h2, h3, .title');
                        let name = titleEl ? titleEl.innerText.trim() : "Unknown";
                        // refined title extraction
                        if (name === "Unknown") {
                            // find uppercase div
                            const divs = Array.from(c.querySelectorAll('div'));
                            const upper = divs.find(d => d.innerText && d.innerText.length > 5 && d.innerText === d.innerText.toUpperCase());
                            if (upper) name = upper.innerText.trim();
                        }

                        return {
                            name: name,
                            url: link ? link.href : null
                        };
                    }).filter(c => c.url && c.url.includes('rfegolf.es/club'));
                });

                if (clubsOnPage.length > 0) {
                    console.log(`Found ${clubsOnPage.length} clubs.`);
                    allClubs = allClubs.concat(clubsOnPage);
                    emptyPagesCount = 0; // reset
                } else {
                    console.log(`No clubs found.`);
                    emptyPagesCount++;
                }

                if (emptyPagesCount >= 2 || pageNum > 50) {
                    console.log("   ⏹️  Stopping scan (no results for 2 consecutive pages or limit reached).");
                    break;
                }

                pageNum++;
                // Small delay to be polite
                await new Promise(r => setTimeout(r, 500));

            } catch (err) {
                console.log(`Error on page ${pageNum}: ${err.message}`);
                break;
            }
        }

        // Deduplicate
        const uniqueClubs = [];
        const map = new Map();
        for (const item of allClubs) {
            if (!map.has(item.url)) {
                map.set(item.url, true);
                uniqueClubs.push(item);
            }
        }
        console.log(`✅ Total Unique Clubs Found: ${uniqueClubs.length}`);


        // --- STEP 2: SCRAPE DETAILS ---
        console.log("\n⛳️ Phase 2: Extracting Scorecards...");

        // Save progress periodically? 
        const finalData = [];

        for (let i = 0; i < uniqueClubs.length; i++) {
            const club = uniqueClubs[i];
            process.stdout.write(`   [${i + 1}/${uniqueClubs.length}] ${club.name.substring(0, 25).padEnd(25)} `);

            try {
                await page.goto(club.url, { waitUntil: 'domcontentloaded', timeout: 20000 });

                const pars = await page.evaluate(() => {
                    // Try to find the scorecard table
                    const table = document.querySelector('.holes-table') || document.querySelector('table.table-striped');
                    if (!table) return null;

                    const rows = Array.from(table.querySelectorAll('tr'));
                    const collectedPars = [];

                    rows.forEach(row => {
                        const cells = Array.from(row.querySelectorAll('td'));
                        // Ensure row has enough data. 
                        // Typically: Hole | Meters | Par | ...

                        // Heuristic: Find a cell with 1-18 (hole) and another with 3-6 (par)
                        if (cells.length >= 3) {
                            const val0 = parseInt(cells[0].innerText); // First col
                            // Par is often 3rd column (index 2), or sometimes 2nd

                            let par = parseInt(cells[2]?.innerText);
                            if (isNaN(par) || par < 3 || par > 6) {
                                par = parseInt(cells[1]?.innerText); // Try 2nd col
                            }
                            // Last resort: check checks
                            if (isNaN(par) || par < 3 || par > 6) {
                                // Iterate
                                for (let c of cells) {
                                    const v = parseInt(c.innerText);
                                    if ([3, 4, 5, 6].includes(v)) {
                                        par = v;
                                        break; // dangerous assumption but OK for now
                                    }
                                }
                            }

                            if (!isNaN(val0) && val0 >= 1 && val0 <= 18 && par >= 3 && par <= 6) {
                                collectedPars[val0 - 1] = par;
                            }
                        }
                    });

                    // Check if we have 18 holes
                    if (collectedPars.filter(p => p).length === 18) {
                        return collectedPars;
                    }
                    return null;
                });

                if (pars) {
                    console.log(`✅ Pars: ${JSON.stringify(pars)}`);
                    finalData.push({
                        name: club.name,
                        url: club.url,
                        pars: pars
                    });
                } else {
                    console.log(`❌ No full scorecard found`);
                }

            } catch (err) {
                console.log(`⚠️  Error`);
            }

            // Periodically save
            if (i % 10 === 0) {
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 4));
            }
        }

        // Final Save
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 4));
        console.log(`\n🎉 DONE! Saved ${finalData.length} valid courses to:`);
        console.log(OUTPUT_FILE);

    } catch (e) {
        console.error("Critical Error", e);
    } finally {
        await browser.close();
    }
}

main();

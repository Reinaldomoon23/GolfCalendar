const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../src/data/scraped_courses.json');
const LIST_URL = 'https://rfegolf.es/clubes?page=1&view=card&entity-type=rfeg';

async function main() {
    console.log("🚀 Starting RFEG Scraper (Puppeteer)...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set a reasonable viewport and User-Agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        // 1. Navigate to List
        console.log(`📄 Navigating to ${LIST_URL}...`);
        await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        const title = await page.title();
        const url = await page.url();
        console.log(`ℹ️ Current Page: "${title}" (${url})`);


        // 2. Apply Filters and Handle Cookies
        console.log("🔍 Applying filters and handling cookies...");
        try {
            // Dismiss Cookie Banner if it exists
            const cookieBtn = await page.$('button#onetrust-accept-btn-handler, #accept-cookies, .cookie-accept'); // Common IDs
            if (cookieBtn) {
                console.log("🍪 Clicking cookie banner...");
                await cookieBtn.click();
                await new Promise(r => setTimeout(r, 1000));
            }

            // Wait for body
            await page.waitForSelector('body', { timeout: 10000 });

            // Click "Filtrar"
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, .btn, a.btn'));
                const filterBtn = buttons.find(b => b.innerText && b.innerText.trim() === 'Filtrar');
                if (filterBtn) filterBtn.click();
            });

            // Wait for modal
            await new Promise(r => setTimeout(r, 1500));

            // Apply checkboxes 
            await page.evaluate(() => {
                const ids = ['filter_list_holes_9', 'filter_list_holes_18', 'filter_list_holes_27', 'filter_list_holes_36'];
                let clicked = 0;
                ids.forEach(id => {
                    const cb = document.getElementById(id);
                    if (cb) {
                        if (!cb.checked) {
                            cb.click();
                            clicked++;
                        }
                    }
                });
                console.log(`Clicked ${clicked} filter checkboxes`);

                // Click Apply
                const applyBtns = Array.from(document.querySelectorAll('button, .save-btn, .btn-primary'));
                const target = applyBtns.find(b => {
                    const text = (b.innerText || "").toLowerCase();
                    return text.includes('aplicar') || text.includes('filtra') || b.classList.contains('save-btn');
                });
                if (target) target.click();
            });

            console.log("⏳ Waiting for results to reload...");
            await new Promise(r => setTimeout(r, 5000));

        } catch (e) {
            console.log("⚠️ Filter/Cookie interaction issue:", e.message);
        }

        // 3. Scrape All Clubs (Pagination)
        let allClubs = [];
        let hasNext = true;
        let pageNum = 1;

        while (hasNext) {
            console.log(`📄 Scraping List Page ${pageNum}...`);

            // Wait for ANY content to be safe
            try {
                // Try multiple valid selectors for the cards
                await page.waitForSelector('.club-card, .maps-list-item, .card', { timeout: 8000 });
            } catch (e) {
                console.log("   ⚠️ No cards found by selector.");
            }

            const clubsOnPage = await page.evaluate(() => {
                // Selector strategy: Try to find ANY link that looks like a club
                const potentialCards = Array.from(document.querySelectorAll('.club-card, .maps-list-item, div.card'));

                return potentialCards.map(c => {
                    const link = c.querySelector('a');
                    // Try to find the title
                    let title = "Unknown";
                    const titleEl = c.querySelector('.club-card__title') || c.querySelector('h2') || c.querySelector('h3') || c.querySelector('.title');

                    if (titleEl) {
                        title = titleEl.innerText.trim();
                    } else {
                        // Fallback: look for uppercase text
                        const divs = Array.from(c.querySelectorAll('div'));
                        const upperDiv = divs.find(d => d.innerText && d.innerText.length > 3 && d.innerText === d.innerText.toUpperCase());
                        if (upperDiv) title = upperDiv.innerText.trim();
                    }

                    return {
                        name: title,
                        url: link ? link.href : null
                    };
                }).filter(c => c.url && c.name && c.name !== "Unknown");
            });

            if (clubsOnPage.length === 0) {
                console.log("   ❌ Still 0 clubs found. Dumping body HTML snippet for debug:");
                const html = await page.evaluate(() => document.body.innerHTML.substring(0, 1000));
                console.log(html);
                break;
            }

            allClubs = allClubs.concat(clubsOnPage);
            console.log(`   ✅ Found ${clubsOnPage.length} clubs. Total: ${allClubs.length}`);

            // Next Page Logic
            const nextBtn = await page.$('.pagination-next:not(.disabled) a, a[aria-label="Next"], .pagination-link-next');
            if (nextBtn) {
                await nextBtn.click();
                await new Promise(r => setTimeout(r, 2000));
                pageNum++;
            } else {
                console.log("   ⏹️ No 'Next' button found. Finished list.");
                hasNext = false;
            }
        }

        // 4. Scrape Details (Pars)
        console.log(`\n⛳️ Scraping Scorecards for ${allClubs.length} clubs...`);
        const finalData = [];

        for (let i = 0; i < allClubs.length; i++) {
            const club = allClubs[i];
            console.log(`[${i + 1}/${allClubs.length}] analyzing ${club.name}...`);

            try {
                await page.goto(club.url, { waitUntil: 'domcontentloaded' });

                // Extract Pars
                const pars = await page.evaluate(() => {
                    const table = document.querySelector('.holes-table');
                    if (!table) return null;

                    const rows = Array.from(table.querySelectorAll('tr'));
                    const parValues = [];

                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        // Look for Hole # and Par
                        // Heuristic: If row has >2 cells, cell 0 is hole, cell 2 is par (usually)
                        if (cells.length >= 3) {
                            const hole = parseInt(cells[0].innerText);
                            const par = parseInt(cells[2].innerText);
                            if (!isNaN(hole) && !isNaN(par) && hole >= 1 && hole <= 18) {
                                parValues[hole - 1] = par;
                            }
                        }
                    });

                    return parValues.filter(p => p).length === 18 ? parValues : null;
                });

                if (pars) {
                    console.log(`   ✅ Pars: [${pars.join(',')}]`);
                    finalData.push({
                        name: club.name,
                        pars: pars
                    });
                } else {
                    console.log(`   ❌ No complete scorecard found.`);
                }

            } catch (err) {
                console.error(`   ❌ Error: ${err.message}`);
            }
        }

        // 5. Save
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 4));
        console.log(`\n🎉 DONE! Saved ${finalData.length} valid courses to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error("Fatal Error:", error);
    } finally {
        await browser.close();
    }
}

main();

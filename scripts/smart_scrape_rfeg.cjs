const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const EXISTING_DB_PATH = path.join(__dirname, '../src/data/spanish_courses.json');
const OUTPUT_FILE = path.join(__dirname, '../src/data/new_scraped_courses.json');
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

// Ensure directories exist
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Normalization helper
function normalizeName(name) {
    if (!name) return "";
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/'/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b(real|club|de|golf|campo|resort|hotel|spa|beach|country|society|sociedad|deportiva|links|course|and)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function main() {
    console.log("🚀 Starting Smart RFEG Scraper v2 (Corrected Selectors)...");

    let existingCourses = [];
    const existingNames = new Set();
    if (fs.existsSync(EXISTING_DB_PATH)) {
        existingCourses = JSON.parse(fs.readFileSync(EXISTING_DB_PATH, 'utf8'));
        existingCourses.forEach(c => existingNames.add(normalizeName(c.name)));
        console.log(`📚 Loaded ${existingCourses.length} existing courses (Will Check All).`);
    }

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // Helper to extract Parsons key
    async function extractParsFromTable(tableHandle) {
        return await tableHandle.evaluate(table => {
            const rows = Array.from(table.querySelectorAll('tr'));
            const pars = [];
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length >= 3) {
                    const hole = parseInt(cells[0].innerText);
                    let par = parseInt(cells[2]?.innerText);
                    if (isNaN(par) || par < 3 || par > 6) par = parseInt(cells[1]?.innerText);

                    if (!isNaN(hole) && hole >= 1 && hole <= 18 && !isNaN(par)) {
                        pars[hole - 1] = par;
                    }
                }
            });
            if (pars.filter(p => p).length === 18) return pars;
            return null;
        });
    }

    let pageNum = 27;
    let newCoursesFound = [];
    const MAX_PAGES = 50;

    while (pageNum <= MAX_PAGES) {
        const listUrl = `https://rfegolf.es/clubes?page=${pageNum}&view=card&entity-type=rfeg`;
        console.log(`\n📄 Scanning List Page ${pageNum}...`);

        try {
            await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // --- AUTO SCROLL (Lazy Loading Fix) ---
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 300;
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= document.body.scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
            await new Promise(r => setTimeout(r, 2000));
            // --------------------------------------

            // Extract links using UPDATED SELECTORS
            const clubLinks = await page.evaluate(() => {
                // Selector: a.maps-list-item or a inside .club-card
                const candidates = Array.from(document.querySelectorAll('a.maps-list-item, .club-card a, div.card a'));

                return candidates.map(c => {
                    const url = c.href;
                    // Find Title: .explore-item__title usually inside
                    let titleEl = c.querySelector('.explore-item__title, .club-card__title, h2, h3, strong');
                    let name = "Unknown";

                    if (titleEl) {
                        name = titleEl.innerText.trim();
                    } else if (c.innerText) {
                        // Fallback
                        name = c.innerText.split('\n')[0].trim();
                    }

                    return { name, url };
                }).filter(x => x.url && x.url.includes('/club/') && x.name && x.name.length > 2);
            });

            if (clubLinks.length === 0) {
                console.log("⏹️ No more clubs found. Stopping.");
                break;
            }

            console.log(`   Found ${clubLinks.length} clubs on this page.`);

            // DEDUPLICATE LINKS on this page
            const uniqueLinks = [];
            const seenMap = new Set();
            for (const item of clubLinks) {
                if (!seenMap.has(item.url)) {
                    seenMap.add(item.url);
                    uniqueLinks.push(item);
                }
            }

            // Iterate Clubs
            for (const club of uniqueLinks) {
                const normName = normalizeName(club.name);

                // SKIPPING logic disabled as requested
                /* if (existingNames.has(normName)) { process.stdout.write('.'); continue; } */

                console.log(`\n   🔍 Checking: ${club.name}`);

                const clubPage = await browser.newPage();
                try {
                    await clubPage.goto(club.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    // 1. "Recorridos y Hoyos" section
                    const sectionFound = await clubPage.evaluate(() => {
                        const allHeaders = Array.from(document.querySelectorAll('h1,h2,h3,h4,div,span,strong'));
                        const target = allHeaders.find(el => el.innerText && el.innerText.includes('Recorridos y Hoyos'));
                        if (target) { target.scrollIntoView(); return true; }
                        return false;
                    });

                    if (!sectionFound) {
                        console.log("      ⚠️ Section not found.");
                        await clubPage.close();
                        continue;
                    }

                    // 2. Dropdown Logic
                    const options = await clubPage.evaluate(() => {
                        const selects = Array.from(document.querySelectorAll('select'));
                        for (let s of selects) {
                            if (s.options.length > 1) {
                                return Array.from(s.options).map((o, idx) => ({
                                    text: o.innerText,
                                    value: o.value,
                                    selector: 'select' // Simplified
                                }));
                            }
                        }
                        return [];
                    });

                    const layouts = [];

                    if (options && options.length > 1) {
                        console.log(`      Found ${options.length} options. Grouping...`);

                        // Grouping Logic
                        const groups = {};
                        options.forEach(opt => {
                            let baseName = opt.text
                                .replace(/\b(Blancas|Amarillas|Rojas|Azules|Negras|Masc|Fem)\b/gi, '')
                                .replace(/[\(\-]\s*[MF]\s*[\)\-]/gi, '')
                                .replace(/[-_]/g, ' ')
                                .trim();
                            if (baseName.length < 3) baseName = "General";
                            if (!groups[baseName]) groups[baseName] = [];
                            groups[baseName].push(opt);
                        });

                        const uniqueOptions = [];
                        for (const [name, opts] of Object.entries(groups)) {
                            // Prefer Amarillas
                            let chosen = opts.find(o => o.text.toLowerCase().includes('amarilla'));
                            if (!chosen) chosen = opts[0];
                            uniqueOptions.push({ ...chosen, displayName: name });
                        }

                        console.log(`      Distinct: ${uniqueOptions.map(u => u.displayName).join(', ')}`);

                        // Find the select element handle again
                        const selectHandle = await clubPage.$('select');

                        for (const opt of uniqueOptions) {
                            if (selectHandle) {
                                await clubPage.select('select', opt.value);
                                await new Promise(r => setTimeout(r, 2000));

                                const tableHandle = await clubPage.$('.holes-table, table');
                                if (tableHandle) {
                                    const pars = await extractParsFromTable(tableHandle);
                                    if (pars) {
                                        layouts.push({ name: opt.displayName, pars });
                                        const safeName = normalizeName(club.name + "_" + opt.displayName).replace(/\s/g, '_');
                                        await tableHandle.screenshot({ path: path.join(SCREENSHOTS_DIR, `${safeName}.png`) });
                                        console.log(`         📸 Saved: ${safeName}.png`);
                                    }
                                }
                            }
                        }
                    } else {
                        // Single Layout
                        const tableHandle = await clubPage.$('.holes-table, table');
                        if (tableHandle) {
                            const pars = await extractParsFromTable(tableHandle);
                            if (pars) {
                                layouts.push({ name: "General", pars });
                                const safeName = normalizeName(club.name).replace(/\s/g, '_');
                                await tableHandle.screenshot({ path: path.join(SCREENSHOTS_DIR, `${safeName}.png`) });
                                console.log(`      📸 Saved: ${safeName}.png`);
                            }
                        }
                    }

                    if (layouts.length > 0) {
                        newCoursesFound.push({ name: club.name, url: club.url, layouts });
                        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(newCoursesFound, null, 4));
                    }

                } catch (e) {
                    console.error(`      ❌ Error: ${e.message}`);
                } finally {
                    await clubPage.close();
                }
            }

        } catch (err) {
            console.error(`Error Page ${pageNum}:`, err);
        }

        pageNum++;
    }

    await browser.close();
    console.log("✅ Done.");
}

main();

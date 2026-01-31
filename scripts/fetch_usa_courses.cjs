const https = require('https');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const OUTPUT_FILE = path.join(__dirname, '../src/data/usa_courses.json');
const PROGRESS_FILE = path.join(__dirname, '../src/data/usa_courses_progress.json');

// API Configuration - We'll try multiple free sources
const SOURCES = {
    golfCourseAPI: {
        name: 'GolfCourseAPI.com',
        baseUrl: 'api.golfcourseapi.com',
        requiresKey: true,
        free: true
    }
};

// Helper function to make HTTPS requests
function httpsRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);

        if (postData) {
            req.write(postData);
        }

        req.end();
    });
}

// Delay helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Save progress
function saveProgress(data) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

// Load progress
function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
    return { courses: [], lastState: null, completed: false };
}

async function main() {
    console.log('🇺🇸 USA Golf Courses Data Fetcher\n');
    console.log('═'.repeat(70));

    // Check for API key
    const apiKey = process.env.GOLF_API_KEY;

    if (!apiKey) {
        console.log('\n⚠️  No API key found!');
        console.log('\n📋 To get started with FREE access:');
        console.log('   1. Visit: https://golfcourseapi.com');
        console.log('   2. Sign up for FREE account (300 requests/day)');
        console.log('   3. Get your API key');
        console.log('   4. Run: export GOLF_API_KEY="your_key_here"');
        console.log('   5. Run this script again\n');

        console.log('🔄 Alternative: Using public web scraping approach...\n');
        await scrapePublicSources();
        return;
    }

    console.log('✅ API Key found! Starting data fetch...\n');
    await fetchFromGolfCourseAPI(apiKey);
}

// Method 1: Using GolfCourseAPI.com (requires free API key)
async function fetchFromGolfCourseAPI(apiKey) {
    const progress = loadProgress();
    const allCourses = progress.courses || [];

    console.log('📡 Fetching from GolfCourseAPI.com...');
    console.log(`📊 Already fetched: ${allCourses.length} courses\n`);

    // US States
    const states = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];

    const startState = progress.lastState || 0;

    for (let i = startState; i < states.length; i++) {
        const state = states[i];
        console.log(`\n🏌️  Processing ${state} (${i + 1}/${states.length})...`);

        try {
            const options = {
                hostname: 'api.golfcourseapi.com',
                path: `/v1/courses?state=${state}&country=US`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            const data = await httpsRequest(options);

            if (data && data.courses) {
                console.log(`   ✅ Found ${data.courses.length} courses`);
                allCourses.push(...data.courses);

                // Save progress
                saveProgress({
                    courses: allCourses,
                    lastState: i,
                    completed: false
                });
            }

            // Rate limiting: 300 requests/day = ~12 requests/hour
            // Wait 5 seconds between requests to be safe
            await delay(5000);

        } catch (error) {
            console.error(`   ❌ Error fetching ${state}:`, error.message);

            if (error.message.includes('429') || error.message.includes('rate limit')) {
                console.log('\n⏸️  Rate limit reached. Progress saved.');
                console.log('   Wait 24 hours and run again to continue.\n');
                return;
            }
        }
    }

    // Save final data
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allCourses, null, 2));
    saveProgress({ courses: allCourses, lastState: states.length, completed: true });

    console.log('\n✅ COMPLETED!');
    console.log(`📊 Total courses fetched: ${allCourses.length}`);
    console.log(`💾 Saved to: ${OUTPUT_FILE}\n`);
}

// Method 2: Web scraping public sources (fallback)
async function scrapePublicSources() {
    console.log('🌐 Starting public web scraping approach...\n');
    console.log('📋 This will scrape publicly available data from:');
    console.log('   • USGA Course Rating Database');
    console.log('   • Public golf course directories\n');

    console.log('⚠️  Note: This method is slower but doesn\'t require API key\n');
    console.log('🔧 Creating scraper script...\n');

    // Create a Puppeteer-based scraper
    const scraperPath = path.join(__dirname, 'scrape_usa_courses_puppeteer.cjs');

    const scraperCode = `const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../src/data/usa_courses.json');

async function main() {
    console.log('🚀 Starting USA Golf Courses Scraper...\\n');
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    const allCourses = [];
    
    // Example: Scrape from a public directory
    // You'll need to identify the best public sources
    
    console.log('📊 Scraping public golf course directories...');
    console.log('⚠️  This is a template - you need to identify target websites\\n');
    
    // TODO: Add specific scraping logic here
    // Example targets:
    // - Golf course review sites
    // - State golf associations
    // - Public course directories
    
    await browser.close();
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allCourses, null, 2));
    console.log(\`\\n✅ Saved \${allCourses.length} courses to \${OUTPUT_FILE}\`);
}

main().catch(console.error);
`;

    fs.writeFileSync(scraperPath, scraperCode);
    console.log(`✅ Created scraper template: ${scraperPath}\n`);
    console.log('📝 Next steps:');
    console.log('   1. Get a FREE API key from golfcourseapi.com (RECOMMENDED)');
    console.log('   2. OR modify the scraper template to target specific websites\n');
}

main().catch(console.error);

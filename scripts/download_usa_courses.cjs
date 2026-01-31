const https = require('https');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const OUTPUT_FILE = path.join(__dirname, '../src/data/usa_courses.json');
const PROGRESS_FILE = path.join(__dirname, '../src/data/usa_download_progress.json');

// OpenStreetMap Overpass API (FREE and PUBLIC)
const OVERPASS_API = 'overpass-api.de';

function httpsRequest(hostname, path, method = 'GET', postData = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname,
            path,
            method,
            headers: {
                'User-Agent': 'GolfCoursesDownloader/1.0',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        if (postData) {
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveProgress(data) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
    console.log(`   💾 Progress saved (${data.courses.length} courses)`);
}

function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
    return { courses: [], statesCompleted: [], currentBatch: 0 };
}

async function queryOverpassAPI(query) {
    const postData = `data=${encodeURIComponent(query)}`;

    try {
        const result = await httpsRequest(
            OVERPASS_API,
            '/api/interpreter',
            'POST',
            postData
        );
        return result;
    } catch (error) {
        throw error;
    }
}

async function fetchGolfCoursesByState(stateName, stateAbbr) {
    console.log(`\n🏌️  Fetching golf courses in ${stateName} (${stateAbbr})...`);

    // Overpass QL query to get all golf courses in a state
    const query = `
[out:json][timeout:60];
area["ISO3166-2"="US-${stateAbbr}"]->.searchArea;
(
  node["leisure"="golf_course"](area.searchArea);
  way["leisure"="golf_course"](area.searchArea);
  relation["leisure"="golf_course"](area.searchArea);
);
out center tags;
`;

    try {
        const data = await queryOverpassAPI(query);

        if (!data || !data.elements) {
            console.log(`   ⚠️  No data returned for ${stateAbbr}`);
            return [];
        }

        const courses = data.elements.map(element => {
            const tags = element.tags || {};

            // Get coordinates
            let lat, lon;
            if (element.lat && element.lon) {
                lat = element.lat;
                lon = element.lon;
            } else if (element.center) {
                lat = element.center.lat;
                lon = element.center.lon;
            }

            // Extract course information
            const name = tags.name || tags['name:en'] || 'Unnamed Golf Course';
            const holes = parseInt(tags.holes) || 18;
            const access = tags.access || 'public';
            const phone = tags.phone || tags['contact:phone'] || null;
            const website = tags.website || tags['contact:website'] || null;

            return {
                name: name.trim(),
                location: `${tags.city || tags.addr_city || stateAbbr}, ${stateAbbr}`,
                state: stateAbbr,
                country: 'USA',
                latitude: lat || null,
                longitude: lon || null,
                holes: holes,
                type: access === 'private' ? 'private' : 'public',
                phone: phone,
                website: website,
                pars: null, // Will need to be filled later
                url: website,
                source: 'OpenStreetMap',
                osmId: element.id,
                lastUpdated: new Date().toISOString()
            };
        });

        console.log(`   ✅ Found ${courses.length} courses`);
        return courses;

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);

        if (error.message.includes('429')) {
            console.log('   ⏸️  Rate limit hit. Waiting 60 seconds...');
            await delay(60000);
            return await fetchGolfCoursesByState(stateName, stateAbbr);
        }

        return [];
    }
}

async function main() {
    console.log('🇺🇸 USA GOLF COURSES DOWNLOADER (OpenStreetMap)\n');
    console.log('═'.repeat(70));
    console.log('\n📡 Data Source: OpenStreetMap Overpass API');
    console.log('✅ Completely FREE and PUBLIC');
    console.log('📊 Real-time, community-maintained data');
    console.log('🌍 Global coverage with detailed information\n');
    console.log('═'.repeat(70));

    const progress = loadProgress();
    const allCourses = progress.courses || [];
    const completedStates = new Set(progress.statesCompleted || []);

    console.log(`\n📈 Current Progress: ${allCourses.length} courses downloaded`);
    console.log(`✅ Completed states: ${completedStates.size}/50\n`);

    // US States
    const states = [
        { name: 'Alabama', abbr: 'AL' },
        { name: 'Alaska', abbr: 'AK' },
        { name: 'Arizona', abbr: 'AZ' },
        { name: 'Arkansas', abbr: 'AR' },
        { name: 'California', abbr: 'CA' },
        { name: 'Colorado', abbr: 'CO' },
        { name: 'Connecticut', abbr: 'CT' },
        { name: 'Delaware', abbr: 'DE' },
        { name: 'Florida', abbr: 'FL' },
        { name: 'Georgia', abbr: 'GA' },
        { name: 'Hawaii', abbr: 'HI' },
        { name: 'Idaho', abbr: 'ID' },
        { name: 'Illinois', abbr: 'IL' },
        { name: 'Indiana', abbr: 'IN' },
        { name: 'Iowa', abbr: 'IA' },
        { name: 'Kansas', abbr: 'KS' },
        { name: 'Kentucky', abbr: 'KY' },
        { name: 'Louisiana', abbr: 'LA' },
        { name: 'Maine', abbr: 'ME' },
        { name: 'Maryland', abbr: 'MD' },
        { name: 'Massachusetts', abbr: 'MA' },
        { name: 'Michigan', abbr: 'MI' },
        { name: 'Minnesota', abbr: 'MN' },
        { name: 'Mississippi', abbr: 'MS' },
        { name: 'Missouri', abbr: 'MO' },
        { name: 'Montana', abbr: 'MT' },
        { name: 'Nebraska', abbr: 'NE' },
        { name: 'Nevada', abbr: 'NV' },
        { name: 'New Hampshire', abbr: 'NH' },
        { name: 'New Jersey', abbr: 'NJ' },
        { name: 'New Mexico', abbr: 'NM' },
        { name: 'New York', abbr: 'NY' },
        { name: 'North Carolina', abbr: 'NC' },
        { name: 'North Dakota', abbr: 'ND' },
        { name: 'Ohio', abbr: 'OH' },
        { name: 'Oklahoma', abbr: 'OK' },
        { name: 'Oregon', abbr: 'OR' },
        { name: 'Pennsylvania', abbr: 'PA' },
        { name: 'Rhode Island', abbr: 'RI' },
        { name: 'South Carolina', abbr: 'SC' },
        { name: 'South Dakota', abbr: 'SD' },
        { name: 'Tennessee', abbr: 'TN' },
        { name: 'Texas', abbr: 'TX' },
        { name: 'Utah', abbr: 'UT' },
        { name: 'Vermont', abbr: 'VT' },
        { name: 'Virginia', abbr: 'VA' },
        { name: 'Washington', abbr: 'WA' },
        { name: 'West Virginia', abbr: 'WV' },
        { name: 'Wisconsin', abbr: 'WI' },
        { name: 'Wyoming', abbr: 'WY' }
    ];

    console.log('🚀 Starting download...\n');

    for (const state of states) {
        if (completedStates.has(state.abbr)) {
            console.log(`⏭️  Skipping ${state.name} (already completed)`);
            continue;
        }

        const courses = await fetchGolfCoursesByState(state.name, state.abbr);
        allCourses.push(...courses);
        completedStates.add(state.abbr);

        // Save progress after each state
        saveProgress({
            courses: allCourses,
            statesCompleted: Array.from(completedStates),
            lastUpdated: new Date().toISOString()
        });

        // Be respectful to the API - wait between requests
        console.log('   ⏳ Waiting 3 seconds before next request...');
        await delay(3000);
    }

    // Remove duplicates
    console.log('\n🔄 Removing duplicates...');
    const uniqueCourses = removeDuplicates(allCourses);
    console.log(`   Removed ${allCourses.length - uniqueCourses.length} duplicates`);

    // Save final data
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueCourses, null, 2));

    console.log('\n' + '═'.repeat(70));
    console.log('✅ DOWNLOAD COMPLETE!\n');
    console.log(`📊 Total courses: ${uniqueCourses.length}`);
    console.log(`💾 Saved to: ${OUTPUT_FILE}`);

    const stats = generateStats(uniqueCourses);
    console.log('\n📈 Statistics:');
    console.log(`   • States covered: ${completedStates.size}`);
    console.log(`   • Public courses: ${stats.public}`);
    console.log(`   • Private courses: ${stats.private}`);
    console.log(`   • 18-hole courses: ${stats.holes18}`);
    console.log(`   • 9-hole courses: ${stats.holes9}`);
    console.log(`   • With coordinates: ${stats.withCoords}`);
    console.log(`   • With website: ${stats.withWebsite}`);
    console.log(`   • With phone: ${stats.withPhone}`);

    console.log('\n⚠️  Note: Scorecard/par data not included.');
    console.log('   To get par data, you can:');
    console.log('   1. Use the free API from golfcourseapi.com');
    console.log('   2. Scrape individual course websites');
    console.log('   3. Use the website URLs provided to fetch data\n');
    console.log('═'.repeat(70) + '\n');

    // Clean up progress file
    if (fs.existsSync(PROGRESS_FILE)) {
        fs.unlinkSync(PROGRESS_FILE);
    }
}

function removeDuplicates(courses) {
    const seen = new Map();

    return courses.filter(course => {
        const key = `${course.name.toLowerCase()}_${course.state}`;

        if (seen.has(key)) {
            // Keep the one with more information
            const existing = seen.get(key);
            if (course.website && !existing.website) {
                seen.set(key, course);
                return false;
            }
            return false;
        }

        seen.set(key, course);
        return true;
    });
}

function generateStats(courses) {
    return {
        public: courses.filter(c => c.type === 'public').length,
        private: courses.filter(c => c.type === 'private').length,
        holes18: courses.filter(c => c.holes === 18).length,
        holes9: courses.filter(c => c.holes === 9).length,
        withCoords: courses.filter(c => c.latitude && c.longitude).length,
        withWebsite: courses.filter(c => c.website).length,
        withPhone: courses.filter(c => c.phone).length
    };
}

main().catch(console.error);

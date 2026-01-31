const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../src/data/spanish_courses.json');
const courses = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Normalization for grouping
function getRootName(name) {
    return name.toLowerCase()
        .replace(/club de golf/g, '')
        .replace(/golf club/g, '')
        .replace(/golf/g, '')
        .replace(/resort/g, '')
        .replace(/\b(stadium|tour|links|forest|mas|valles|baix|alt)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const catalanProvinces = ['BARCELONA', 'GIRONA', 'TARRAGONA', 'LLEIDA'];

const clubs = {};

courses.forEach(c => {
    let isCatalan = false;

    // Check metadata if available
    if (c.province && catalanProvinces.includes(c.province.toUpperCase())) {
        isCatalan = true;
    }
    // Fallback: Check lists of known catalan locations if metadata missing
    // or scraping logic didn't fill it for old courses.
    // Let's assume metadata is present for the 300 new ones.
    // For old ones, we might miss them if they don't have 'province'.
    // Let's try to detect by name for famous ones just in case.
    if (!c.province) {
        const n = c.name.toLowerCase();
        if (n.includes('camiral') || n.includes('pga catalunya') || n.includes('emporda') || n.includes('infinitum') || n.includes('lumine') || n.includes('bonmont') || n.includes('prat') || n.includes('terramar') || n.includes('vallromanes') || n.includes('llavaneras') || n.includes('el prat') || n.includes('cerdanya') || n.includes('peralada') || n.includes('torremirona') || n.includes('montanya') || n.includes('fontanals') || n.includes('aro') || n.includes('costa brava') || n.includes('pals')) {
            isCatalan = true;
        }
    }

    if (isCatalan) {
        // Grouping
        let root = getRootName(c.name);

        // Manual fix for big resorts to ensure grouping
        if (c.name.toLowerCase().includes('camiral')) root = 'camiral (pga catalunya)';
        if (c.name.toLowerCase().includes('emporda')) root = 'emporda';
        if (c.name.toLowerCase().includes('infinitum')) root = 'infinitum';
        if (c.name.toLowerCase().includes('prat')) root = 'el prat';

        if (!clubs[root]) {
            clubs[root] = {
                name: root,
                courses: [],
                totalHoles: 0
            };
        }
        clubs[root].courses.push(c.name);
        clubs[root].totalHoles += (c.pars ? c.pars.length : 18);
    }
});

// Sort by total holes
const sortedClubs = Object.values(clubs).sort((a, b) => b.totalHoles - a.totalHoles);

console.log("⛳️ Top Clubs with most holes in Catalunya:\n");
sortedClubs.slice(0, 10).forEach((c, i) => {
    console.log(`${i + 1}. ${c.name.toUpperCase()} - ${c.totalHoles} hoyos`);
    console.log(`   Courses: ${c.courses.join(', ')}`);
});

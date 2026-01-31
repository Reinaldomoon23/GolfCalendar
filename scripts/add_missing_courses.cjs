const fs = require('fs');
const path = require('path');

const originalPath = path.join(__dirname, '../src/data/spanish_courses.json');
const scrapedPath = path.join(__dirname, '../src/data/scraped_courses.json');

function normalizeName(name) {
    if (!name) return "";
    let n = name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/'/g, ' ') // remove apostrophes
        .replace(/-/g, ' ')
        .replace(/\b(real|club|de|golf|campo|resort|hotel|spa|beach|country|society|sociedad|deportiva|links|course|and)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return n;
}

try {
    if (!fs.existsSync(originalPath) || !fs.existsSync(scrapedPath)) {
        console.error("❌ Error: Files not found.");
        process.exit(1);
    }

    const courses = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
    const scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));

    const existingNames = new Set();
    courses.forEach(c => {
        existingNames.add(normalizeName(c.name));
    });

    let addedCount = 0;
    const newCourses = [];

    scrapedData.forEach(scraped => {
        const normName = normalizeName(scraped.name);

        // precise skip: check if we already have this course
        if (existingNames.has(normName)) {
            return;
        }

        // Check if we have valid 18-hole pars
        let bestPars = null;
        if (scraped.pars && scraped.pars.length === 18) {
            bestPars = scraped.pars;
        } else if (scraped.layouts && scraped.layouts.length > 0) {
            const layout18 = scraped.layouts.find(l => l.pars && l.pars.length === 18);
            if (layout18) bestPars = layout18.pars;
        }

        if (bestPars) {
            // New Course!
            const newCourse = {
                name: scraped.name, // Keep original scraped name (usually UPPERCASE from RFEG, consider Title Casing?)
                pars: bestPars,
                // Add extra metadata if available
                address: scraped.address,
                city: scraped.city,
                zip: scraped.zip,
                province: scraped.province,
                region: scraped.region,
                web: scraped.link,
                // If it has layouts, maybe keep them? For now, flat structure implies just main pars.
            };

            // Helper to title case if needed? RFEG is all caps. 
            // Let's keep it as is or do simple capitalization?
            // User probably prefers Title Case.
            newCourse.name = toTitleCase(newCourse.name);
            if (newCourse.address) newCourse.address = toTitleCase(newCourse.address);
            if (newCourse.city) newCourse.city = toTitleCase(newCourse.city);

            newCourses.push(newCourse);
            existingNames.add(normName); // Add to set to avoid duplicates within scraped file
            addedCount++;
        }
    });

    if (addedCount > 0) {
        const finalCourses = [...courses, ...newCourses];
        // Sort by name?
        finalCourses.sort((a, b) => a.name.localeCompare(b.name));

        fs.writeFileSync(originalPath, JSON.stringify(finalCourses, null, 4), 'utf8');
        console.log(`🎉 Added ${addedCount} new courses to spanish_courses.json!`);
        console.log(`Total courses: ${finalCourses.length}`);
    } else {
        console.log("No new courses found to add.");
    }

} catch (e) {
    console.error("Error:", e);
}

function toTitleCase(str) {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

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

    if (name.toLowerCase().includes("castiello") || name.toLowerCase().includes("atalaya")) {
        console.log(`[DEBUG] '${name}' -> '${n}'`);
    }
    return n;
}

try {
    if (!fs.existsSync(scrapedPath)) {
        console.error("❌ Error: 'scraped_courses.json' not found.");
        process.exit(1);
    }

    const courses = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
    const scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));

    let updatedCount = 0;

    // Create a map for faster lookup
    const scrapedMap = new Map();

    // Manual Aliases to fix tricky ones
    // Key: Name in spanish_courses.json (normalized) -> Value: Name in scraped_courses.json (normalized) OR Direct Pars
    const manualAliases = {
        "alcaidesa": "hacienda",
        "flamingos": "villa padierna",
        "anfi": "anfi tauro",
        // Add specific fix for Castiello if fuzzy still fails
        "castiello": "castiello",
        "cerdanya": "cerdanya",
        "vall d or": "vall d or",
        "bilbil": "bil bil",
        "d aro": "daro",
        "peralada": "perelada",
        "cerdanya": "cerdana",
        "montenmedio": "dehesa montenmedio",
        "las ramblas": "las ramblas campoamor",
        "alhama": "alhama signature",
        "vistahermosa": "vista hermosa"
    };

    scrapedData.forEach(c => {
        let bestPars = null;
        // Check if top-level pars exist (from my scraping attempt)
        if (c.pars && c.pars.length === 18) {
            bestPars = c.pars;
        }
        // Check layouts (from user's scraping)
        else if (c.layouts && c.layouts.length > 0) {
            // Find first layout with 18 pars
            const layout18 = c.layouts.find(l => l.pars && l.pars.length === 18);
            if (layout18) {
                bestPars = layout18.pars;
            }
        }

        if (bestPars) {
            scrapedMap.set(c.name, bestPars);
            scrapedMap.set(normalizeName(c.name), bestPars);

            // Allow looking up by partials if unique? Too risky.
        }
    });

    // 0. Clean up deprecated courses and RENAME
    const cleanCourses = courses.map(c => {
        let newName = c.name;
        // Rename Alcaidesa to La Hacienda
        if (c.name.toLowerCase().includes('alcaidesa links')) {
            newName = "La Hacienda Links Golf Resort";
        }
        // Rename Flamingos to Villa Padierna
        else if (c.name.toLowerCase().includes('flamingos golf')) {
            newName = "Villa Padierna Golf Club";
        }
        // Rename Barbiguera
        else if (c.name.toLowerCase().includes('barbiguera')) {
            newName = "Panoramica Golf, Sports & Resort";
        }

        if (newName !== c.name) {
            console.log(`   🔄 Renaming '${c.name}' -> '${newName}'`);
            return { ...c, name: newName };
        }
        return c;
    }).filter(c => {
        // Remove PGA Catalunya (replaced by Camiral)
        if (c.name.toLowerCase().includes('pga catalunya')) return false;
        // Remove Estepona Golf
        if (c.name.toLowerCase().includes('estepona golf')) return false;
        // Remove Golf Girona
        if (c.name.toLowerCase().includes('golf girona')) return false;
        // Remove Santana Golf
        if (c.name.toLowerCase().includes('santana golf')) return false;
        // Remove T-Golf
        if (c.name.toLowerCase().includes('t-golf')) return false;
        // Remove duplicate Alcaidesa if strictly named 'Alcaidesa Links' and we just renamed one? 
        // No, map handles the rename in place.
        return true;
    });

    const updatedCourses = cleanCourses.map(course => {
        // If it already has pars (and they are valid 18), skip
        if (course.pars && course.pars.length === 18) {
            return course;
        }

        // Try to find Pars
        let foundPars = scrapedMap.get(course.name);

        if (!foundPars) {
            // Try strict normalization
            foundPars = scrapedMap.get(normalizeName(course.name));
        }

        // Manual Alias Lookup
        if (!foundPars) {
            const normTarget = normalizeName(course.name);
            for (const [aliasKey, targetKey] of Object.entries(manualAliases)) {
                if (normTarget.includes(aliasKey) || aliasKey.includes(normTarget)) {
                    // Try to find the targetKey in scrapedMap (it requires targetKey to be the normalized name of scraped course)
                    // We need to iterate scrapedMap keys? Or just guess?
                    // Actually, let's just use fuzzy search on scraped map using targetKey

                    // Simple try:
                    foundPars = scrapedMap.get(targetKey);
                    if (!foundPars) {
                        // Find by fuzzy match on the alias target
                        for (const [sKey, sVal] of scrapedMap.entries()) {
                            if (normalizeName(sKey).includes(targetKey)) {
                                foundPars = sVal;
                                break;
                            }
                        }
                    }
                    if (foundPars) {
                        console.log(`   💡 Manual Alias match: '${course.name}' mapped to '${targetKey}'`);
                        break;
                    }
                }
            }
        }

        // Fuzzy search? (e.g. contains or parts)
        if (!foundPars) {
            const normTarget = normalizeName(course.name);
            // Example: "abama golf club" vs "campo de golf abama" -> "abama club" vs "abama"
            // Let's try to match if one includes the other (length > 3)
            for (const [key, val] of scrapedMap.entries()) {
                const normKey = normalizeName(key);
                // Check if scraped key contains target or vice-versa
                // Use original key for map lookup if normKey match found? No, val is already there.
                // We iterate entries of map where key is potentially raw or normalized. 
                // Since we set both raw and normalized keys in the map, iteration will cover both.

                if (normKey.length > 3 && normTarget.length > 3) {
                    if (normKey.includes(normTarget) || normTarget.includes(normKey)) {
                        /* console.log(`   💡 Fuzzy match: '${course.name}' matched with map key '${key}'`); */
                        foundPars = val;
                        break;
                    }
                }
            }
        }

        if (foundPars) {
            console.log(`✅ Updating pars for: ${course.name}`);
            updatedCount++;
            return {
                ...course,
                pars: foundPars
            };
        }

        // Manual Injection for known missing courses
        // Manual Injection for known missing courses
        if (normalizeName(course.name).includes('serres')) {
            console.log(`   💉 Manual Injection for: ${course.name}`);
            updatedCount++;
            return {
                ...course,
                pars: [4, 5, 4, 3, 5, 4, 4, 3, 4, 4, 3, 4, 5, 3, 4, 4, 5, 4] // From User Image
            };
        }
        if (normalizeName(course.name).includes('guadiana')) {
            console.log(`   💉 Manual Injection for: ${course.name}`);
            updatedCount++;
            return {
                ...course,
                pars: [5, 3, 4, 4, 3, 4, 5, 4, 4, 4, 4, 4, 3, 5, 4, 3, 4, 5] // From User Image
            };
        }

        console.log(`🔸 Still missing pars for: ${course.name}`);
        return course;
    });

    fs.writeFileSync(originalPath, JSON.stringify(updatedCourses, null, 4), 'utf8');
    console.log(`\n🎉 Success! Updated ${updatedCount} courses with new par data.`);

} catch (e) {
    console.error("Error merging files:", e);
}

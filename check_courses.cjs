const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, 'src/data/spanish_courses.json');

try {
    const data = fs.readFileSync(coursesPath, 'utf8');
    const courses = JSON.parse(data);

    console.log(`Total courses found: ${courses.length}`);

    const missingPars = [];
    const invalidPars = [];

    courses.forEach(c => {
        if (!c.pars) {
            missingPars.push(c.name);
        } else if (!Array.isArray(c.pars) || c.pars.length !== 18) {
            invalidPars.push(`${c.name} (Length: ${Array.isArray(c.pars) ? c.pars.length : 'Not an array'})`);
        }
    });

    if (missingPars.length > 0) {
        console.log('\n--- Courses MISSING Pars (No scorecard) ---');
        missingPars.forEach(name => console.log(`- ${name}`));
    }

    if (invalidPars.length > 0) {
        console.log('\n--- Courses with INVALID Pars (Not 18 holes) ---');
        invalidPars.forEach(info => console.log(`- ${info}`));
    }

    if (missingPars.length === 0 && invalidPars.length === 0) {
        console.log('\n✅ All courses have valid par data!');
    } else {
        console.log(`\nFound ${missingPars.length} missing and ${invalidPars.length} invalid.`);
    }

} catch (err) {
    console.error("Error reading or parsing file:", err);
}

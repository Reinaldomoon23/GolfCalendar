const fs = require('fs');
const path = require('path');
const readline = require('readline');

const coursesPath = path.join(__dirname, '../src/data/spanish_courses.json');

// Ensure courses file exists
if (!fs.existsSync(coursesPath)) {
    console.error(`Error: Courses file not found at ${coursesPath}`);
    process.exit(1);
}

function loadCourses() {
    return JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
}

function saveCourses(courses) {
    // Sort courses alphabetically by name
    courses.sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 4), 'utf8');
}

function addCourse(name, pars) {
    const courses = loadCourses();
    const existing = courses.find(c => c.name === name);

    if (existing) {
        if (existing.aliasOf) {
            console.log(`Course '${name}' already exists as an alias of '${existing.aliasOf}'.`);
        } else {
            console.log(`Course '${name}' already exists. Updating pars...`);
            existing.pars = pars;
            saveCourses(courses);
            console.log(`Updated pars for '${name}'.`);
        }
    } else {
        courses.push({ name, pars });
        saveCourses(courses);
        console.log(`Added new course '${name}'.`);
    }
}

function addAlias(aliasName, targetName) {
    const courses = loadCourses();
    const target = courses.find(c => c.name === targetName);

    if (!target) {
        console.error(`Error: Target course '${targetName}' not found.`);
        return;
    }

    if (target.aliasOf) {
        console.error(`Error: Cannot create an alias to an alias. Target '${targetName}' is already an alias of '${target.aliasOf}'.`);
        return;
    }

    const existingAlias = courses.find(c => c.name === aliasName);
    if (existingAlias) {
        console.log(`Course/Alias '${aliasName}' already exists.`);
        return;
    }

    courses.push({
        name: aliasName,
        aliasOf: targetName
    });
    saveCourses(courses);
    console.log(`Added alias '${aliasName}' -> '${targetName}'.`);
}

function listCourses(filter) {
    const courses = loadCourses();
    const filtered = filter
        ? courses.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()))
        : courses;

    console.log(`Found ${filtered.length} courses:`);
    filtered.forEach(c => {
        if (c.aliasOf) {
            console.log(` - ${c.name} (Alias -> ${c.aliasOf})`);
        } else {
            const parCount = c.pars ? c.pars.length : 0;
            console.log(` - ${c.name} [${parCount} holes]`);
        }
    });
}

// CLI Argument Parsing
const args = process.argv.slice(2);
const command = args[0];

if (command === 'add') {
    const name = args[1];
    const parsArg = args.find(a => a.startsWith('--pars='));

    if (!name || !parsArg) {
        console.log("Usage: node manage_courses.cjs add \"Name\" --pars=4,4,5...");
        process.exit(1);
    }

    const pars = parsArg.split('=')[1].split(',').map(Number);
    if (pars.length !== 18 && pars.length !== 9) {
        console.warn("Warning: Usually courses have 9 or 18 holes.");
    }
    addCourse(name, pars);

} else if (command === 'alias') {
    const alias = args[1];
    const target = args[2];

    if (!alias || !target) {
        console.log("Usage: node manage_courses.cjs alias \"Alias Name\" \"Real Name\"");
        process.exit(1);
    }

    addAlias(alias, target);

} else if (command === 'list') {
    const filter = args[1];
    listCourses(filter);

} else {
    console.log("Usage:");
    console.log("  node manage_courses.cjs list [filter]");
    console.log("  node manage_courses.cjs add \"Name\" --pars=4,4,5,3...");
    console.log("  node manage_courses.cjs alias \"Alias Name\" \"Real Name\"");
}

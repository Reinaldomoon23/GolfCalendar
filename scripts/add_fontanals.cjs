const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, '../src/data/spanish_courses.json');

try {
    const data = fs.readFileSync(coursesPath, 'utf8');
    let courses = JSON.parse(data);

    const newCourse = {
        "name": "Fontanals Golf Club",
        "pars": [4, 5, 4, 4, 3, 5, 4, 3, 4, 5, 3, 4, 5, 4, 4, 4, 3, 4] // 36/36 = 72
    };

    const newAlias = {
        "name": "Fontanals",
        "aliasOf": "Fontanals Golf Club"
    };

    // Check availability
    if (courses.some(c => c.name === newCourse.name)) {
        console.log("Course already exists.");
    } else {
        courses.push(newCourse);
        console.log("Added Fontanals Golf Club.");
    }

    if (courses.some(c => c.name === newAlias.name)) {
        console.log("Alias already exists.");
    } else {
        courses.push(newAlias);
        console.log("Added Fontanals alias.");
    }

    // Sort alphabetically by name to keep it tidy
    courses.sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 4), 'utf8');
    console.log('Successfully updated spanish_courses.json with Fontanals');

} catch (err) {
    console.error('Error updating courses:', err);
}

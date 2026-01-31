const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, '../src/data/spanish_courses.json');
const courses = require(coursesPath);

const targetCourseName = process.argv[2];
const parsString = process.argv[3]; // Expecting simple CSV string "4,4,5,..."

if (!targetCourseName || !parsString) {
    console.error("Usage: node add_course_pars.cjs \"Course Name\" \"4,4,5...\"");
    process.exit(1);
}

const pars = parsString.split(',').map(Number);
if (pars.length !== 18) {
    console.error("Error: Must provide exactly 18 par values.");
    process.exit(1);
}

let found = false;
const updatedCourses = courses.map(course => {
    if (course.name && course.name.toLowerCase().includes(targetCourseName.toLowerCase())) {
        found = true;
        console.log(`Updating pars for: ${course.name}`);
        return { ...course, pars: pars };
    }
    return course;
});

if (!found) {
    console.error(`Course not found: ${targetCourseName}`);
    process.exit(1);
}

fs.writeFileSync(coursesPath, JSON.stringify(updatedCourses, null, 4), 'utf8');
console.log("Success.");

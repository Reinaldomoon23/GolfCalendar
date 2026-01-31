const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, '../src/data/spanish_courses.json');
const courses = require(coursesPath);

// Target data for Vallromanes
const vallromanesPars = [
    4, 3, 4, 5, 4, 4, 3, 4, 5, // Front 9
    4, 5, 3, 4, 4, 4, 5, 3, 4  // Back 9
];

const newCourses = courses.map(course => {
    // Check if already an object (idempotency)
    if (typeof course === 'object' && course !== null) {
        // Update pars if it's Vallromanes
        if (course.name === 'Club de Golf Vallromanes') {
            return { ...course, pars: vallromanesPars };
        }
        return course;
    }

    // Convert string to object
    const obj = { name: course };
    if (course === 'Club de Golf Vallromanes') {
        obj.pars = vallromanesPars;
    }
    return obj;
});

fs.writeFileSync(coursesPath, JSON.stringify(newCourses, null, 4), 'utf8');
console.log('Courses converted and Vallromanes pars updated.');

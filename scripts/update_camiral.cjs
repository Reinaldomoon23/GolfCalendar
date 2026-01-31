const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, '../src/data/spanish_courses.json');
const courses = require(coursesPath);

const stadiumPars = [4, 4, 5, 4, 3, 4, 5, 3, 4, 4, 3, 5, 4, 4, 5, 3, 4, 4];

// Define the two new courses
const newEntries = [
    { name: "Camiral Stadium", pars: stadiumPars },
    { name: "Camiral Tour", pars: [] } // Empty pars for now
];

let updatedCourses = [...courses];

newEntries.forEach(newC => {
    // Remove if exists to overwrite/update
    updatedCourses = updatedCourses.filter(c => c.name !== newC.name);
    updatedCourses.push(newC);
});

// Sort
updatedCourses.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(coursesPath, JSON.stringify(updatedCourses, null, 4), 'utf8');
console.log("Added Camiral Stadium and Camiral Tour.");

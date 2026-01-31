const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, '../src/data/spanish_courses.json');
const courses = require(coursesPath);

const lakesPars = [4, 5, 4, 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 5, 3, 5];

// Define the new courses
const newEntries = [
    { name: "Infinitum Lakes", pars: lakesPars },
    { name: "Infinitum Hills", pars: [] } // Placeholder
];

// Remove generic "Infinitum Golf" if it exists, or just keep it as alias?
// Better to be specific.
let updatedCourses = courses.filter(c => c.name !== "Infinitum Golf");

// Check/Add
newEntries.forEach(newC => {
    if (!updatedCourses.some(c => c.name === newC.name)) {
        updatedCourses.push(newC);
    } else {
        // Update pars if exists
        updatedCourses = updatedCourses.map(c => {
            if (c.name === newC.name && newC.pars.length > 0) {
                return newC;
            }
            return c;
        });
    }
});

// Sort
updatedCourses.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(coursesPath, JSON.stringify(updatedCourses, null, 4), 'utf8');
console.log("Updated Infinitum Lakes and Hills.");

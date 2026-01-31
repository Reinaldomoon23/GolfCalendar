const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, '../src/data/spanish_courses.json');

try {
    const data = fs.readFileSync(coursesPath, 'utf8');
    let courses = JSON.parse(data);

    const targetCourseName = "Club de Golf Costa Daurada";
    const pars = [5, 3, 5, 4, 4, 4, 4, 4, 4, 3, 5, 3, 4, 4, 5, 4, 3, 4]; // Total 72 (37/35)

    let updated = false;
    courses = courses.map(course => {
        if (course.name === targetCourseName) {
            console.log(`Updating pars for ${targetCourseName}`);
            updated = true;
            return {
                ...course,
                pars: pars
            };
        }
        return course;
    });

    if (!updated) {
        console.error(`Course "${targetCourseName}" not found!`);
    } else {
        fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 4), 'utf8');
        console.log('Successfully updated spanish_courses.json');
    }

} catch (err) {
    console.error('Error updating courses:', err);
}

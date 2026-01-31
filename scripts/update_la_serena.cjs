const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, '../src/data/spanish_courses.json');

try {
    const data = fs.readFileSync(coursesPath, 'utf8');
    let courses = JSON.parse(data);

    const targetCourseName = "La Serena Golf";
    // Pars: Front: 5, 4, 3, 4, 4, 4, 5, 4, 3 (36)
    //       Back:  4, 5, 4, 4, 4, 3, 4, 3, 5 (36)
    const pars = [5, 4, 3, 4, 4, 4, 5, 4, 3, 4, 5, 4, 4, 4, 3, 4, 3, 5];

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

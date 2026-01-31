const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../src/data/spanish_courses.json');
const courses = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Data captured from RFEG
const rosaPars = [5, 4, 3, 4, 4, 3, 4, 4, 5, 5, 3, 4, 3, 4, 4, 4, 4, 5];
const amarilloPars = [4, 3, 4, 5, 4, 3, 4, 4, 5, 4, 5, 3, 4, 4, 4, 5, 3, 4];

let updated = false;

// 1. Rename existing and confirm pars
const existingPrat = courses.find(c => c.name.toLowerCase().includes('real club de golf el prat') && !c.name.toLowerCase().includes('rosa') && !c.name.toLowerCase().includes('amarillo'));

if (existingPrat) {
    console.log("Found generic 'Real Club de Golf El Prat'. Renaming to Rosa...");
    existingPrat.name = "Real Club de Golf El Prat (Recorrido Rosa)";
    existingPrat.pars = rosaPars; // Ensure correct pars
    updated = true;
}

// 2. Add Amarillo if not exists
const existingAmarillo = courses.find(c => c.name.toLowerCase().includes('el prat') && c.name.toLowerCase().includes('amarillo'));

if (!existingAmarillo) {
    console.log("Adding 'Real Club de Golf El Prat (Recorrido Amarillo)'...");
    courses.push({
        name: "Real Club de Golf El Prat (Recorrido Amarillo)",
        pars: amarilloPars,
        address: existingPrat ? existingPrat.address : "",
        city: existingPrat ? existingPrat.city : "",
        zip: existingPrat ? existingPrat.zip : "",
        province: existingPrat ? existingPrat.province : "",
        region: existingPrat ? existingPrat.region : "",
        web: existingPrat ? existingPrat.web : ""
    });
    updated = true;
}

if (updated) {
    // Sort
    courses.sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(dbPath, JSON.stringify(courses, null, 4), 'utf8');
    console.log("✅ El Prat recorridos updated successfully.");
} else {
    console.log("No changes needed.");
}

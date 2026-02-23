const fs = require('fs');
const path = require('path');

const tournamentsPath = path.join(__dirname, 'src/data/tournaments.json');
let tournaments = JSON.parse(fs.readFileSync(tournamentsPath, 'utf8'));

const idsToUpdate = [2, 110, 4, 6, 8, 9, 12, 14, 15, 17, 22, 23, 27, 28, 103, 104];

tournaments = tournaments.map(t => {
    if (idsToUpdate.includes(t.id)) {
        t.valedera = true;
    }
    return t;
});

fs.writeFileSync(tournamentsPath, JSON.stringify(tournaments, null, 4));
console.log(`Updated ${idsToUpdate.length} tournaments in src/data/tournaments.json`);

const fs = require('fs');
const path = require('path');

const coursesPath = path.join(__dirname, '../src/data/spanish_courses.json');
const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));

const withPars = courses.filter(c => c.pars && c.pars.length === 18);
const withoutPars = courses.filter(c => !c.pars || c.pars.length !== 18);

console.log('📊 ANÁLISIS DE TARJETAS DE CAMPO:\n');
console.log('✅ Campos CON tarjeta completa (18 pars):', withPars.length);
console.log('❌ Campos SIN tarjeta completa:', withoutPars.length);
console.log('📈 Total de campos:', courses.length);
console.log('📊 Porcentaje con tarjeta:', ((withPars.length / courses.length) * 100).toFixed(1) + '%');

console.log('\n📋 Primeros 15 campos SIN tarjeta:');
withoutPars.slice(0, 15).forEach((c, i) => {
    const parsInfo = c.pars ? `(tiene ${c.pars.length} pars)` : '(sin pars)';
    console.log(`  ${i + 1}. ${c.name} ${parsInfo}`);
});

console.log('\n✅ Primeros 10 campos CON tarjeta:');
withPars.slice(0, 10).forEach((c, i) => {
    const totalPar = c.pars.reduce((sum, p) => sum + p, 0);
    console.log(`  ${i + 1}. ${c.name} (Par ${totalPar})`);
});

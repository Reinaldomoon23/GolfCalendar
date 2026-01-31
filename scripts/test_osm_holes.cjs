const axios = require('axios');

// Pebble Beach Coordinates (approx center)
const LAT = 36.5698;
const LON = -121.951;
// Radius in meters to search for holes around the center
const RADIUS = 1500;

const query = `
    [out:json][timeout:25];
    (
      node["golf"="hole"](around:${RADIUS},${LAT},${LON});
      way["golf"="hole"](around:${RADIUS},${LAT},${LON});
    );
    out body;
    >;
    out skel qt;
`;

console.log(`🌍 Consultando OpenStreetMap por hoyos cerca de ${LAT}, ${LON}...`);

async function checkHoles() {
    try {
        const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const elements = response.data.elements;
        console.log(`\n📦 Elementos encontrados: ${elements.length}`);

        // Filter for holes that actually have a 'par' tag
        const holesWithPar = elements.filter(e => e.tags && e.tags.par);
        const holesWithRef = elements.filter(e => e.tags && e.tags.ref); // ref is the hole number

        console.log(`⛳️ Hoyos con etiqueta 'par': ${holesWithPar.length}`);
        console.log(`Tx Etiqueta 'ref' (número de hoyo): ${holesWithRef.length}`);

        if (holesWithPar.length > 0) {
            console.log("\nEjemplo de datos encontrados:");
            holesWithPar.slice(0, 5).forEach(h => {
                console.log(`- Hoyo ${h.tags.ref || '?'}: Par ${h.tags.par} (ID: ${h.id})`);
            });

            // Try to reconstruct the scorecard
            // We need to sort by 'ref'
            const scorecard = holesWithPar
                .map(h => ({ hole: parseInt(h.tags.ref), par: parseInt(h.tags.par) }))
                .filter(h => !isNaN(h.hole) && !isNaN(h.par))
                .sort((a, b) => a.hole - b.hole);

            // Deduplicate (take first occurrence of each hole number)
            const uniqueScorecard = [];
            const seen = new Set();
            for (let h of scorecard) {
                if (!seen.has(h.hole)) {
                    uniqueScorecard.push(h);
                    seen.add(h.hole);
                }
            }

            console.log("\n📋 Tarjeta Reconstruida (Primeros 18):");
            console.log(JSON.stringify(uniqueScorecard.slice(0, 18).map(h => h.par)));

        } else {
            console.log("⚠️ Se encontraron objetos 'golf=hole' pero NINGUNO tiene la etiqueta 'par'.");
            console.log("Comprobando si tienen geometría para calcular distancia...");
            // Logic for distance calculation would go here (requires complex lat/lon math on nodes)
        }

    } catch (error) {
        console.error("Error consultando Overpass:", error.message);
    }
}

checkHoles();

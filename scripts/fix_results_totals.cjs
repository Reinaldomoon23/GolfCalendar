const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../public/data');

function fixResults(filename) {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filename}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let data;
    try {
        data = JSON.parse(content);
    } catch (e) {
        console.error(`Error parsing ${filename}:`, e);
        return;
    }

    let modified = false;

    for (const [tournamentId, result] of Object.entries(data)) {
        // Ensure structure exists
        if (!result.rounds) result.rounds = [];
        if (!result.scorecards) result.scorecards = {};

        // Check if we need to recalculate from scorecards
        const scorecards = result.scorecards;
        let grandTotal = 0;
        let roundsModified = false;

        // If scorecards is an object with indices (0, 1) or array
        // The app uses object { 0: {...}, 1: {...} } or array?
        // JSON shows array in recent `cat` output: "scorecards": [ ... ]
        // But App.jsx initializes it as object { roundIdx: ... } in `handleResetCard`.
        // Wait, `cat` output showed `scorecards: [ {pars:[], strokes:[]} ]`.
        // If it's an array, we iterate; if object, we keys.

        const cardIds = Array.isArray(scorecards)
            ? scorecards.map((_, i) => i)
            : Object.keys(scorecards);

        cardIds.forEach(idx => {
            const card = scorecards[idx];
            if (card && card.strokes && Array.isArray(card.strokes)) {
                const sum = card.strokes.reduce((a, b) => a + (parseInt(b) || 0), 0);

                if (sum > 0) {
                    // Update rounds array if empty or mismatch (optional, but let's trust the card)
                    // The App logic: if sum > 0, rounds[idx] = string

                    const currentRoundVal = parseInt(result.rounds[idx]) || 0;

                    if (currentRoundVal !== sum) {
                        console.log(`[${filename}] T=${tournamentId} R=${idx}: Fix round total ${currentRoundVal} -> ${sum}`);
                        result.rounds[idx] = sum.toString();
                        roundsModified = true;
                    }

                    grandTotal += sum;
                }
            }
        });

        if (roundsModified || (grandTotal > 0 && result.total !== grandTotal)) {
            console.log(`[${filename}] T=${tournamentId}: Fix grand total ${result.total} -> ${grandTotal}`);
            result.total = grandTotal;

            // Recalculate average if multi-round
            const validRoundsCount = result.rounds.filter(r => parseInt(r) > 0).length;
            if (validRoundsCount > 0) {
                result.average = (grandTotal / validRoundsCount).toFixed(1);
            }

            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
        console.log(`Saved fixes to ${filename}`);
    } else {
        console.log(`No changes needed for ${filename}`);
    }
}

// Process known result files
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('results_') && f.endsWith('.json'));
files.forEach(fixResults);

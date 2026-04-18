import fs from 'fs';

let content = fs.readFileSync('firestore.rules', 'utf8');

const replacement = `      match /custom_tournaments/{tournamentId} {
        // Read: Owner, manager, or admin
        allow read: if isAdmin() || canAccessUser(userId);

        // Write: Owner, manager, or admin
        allow write: if isAdmin() || canAccessUser(userId);
      }

      match /handicap_history/{historyId} {
        // Read: Owner, manager, or admin
        allow read: if isAdmin() || canAccessUser(userId);

        // Write: Owner, manager, or admin
        allow write: if isAdmin() || canAccessUser(userId);
      }`;

content = content.replace(
  /match \/custom_tournaments\/\{tournamentId\} \{(?:[^{}]*|\{[^{}]*\})*\}/g,
  replacement
);

fs.writeFileSync('firestore.rules', content);

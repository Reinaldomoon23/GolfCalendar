import fs from 'fs';

let content = fs.readFileSync('firestore.rules', 'utf8');

const replacement = `      match /handicap_history/{historyId} {
        // Read: Public so the unauthenticated Nicole single-app can fetch the chart
        allow read: if true;

        // Write: Admin, Owner, or public ONLY for the 'nicole' profile (since her app operates without login)
        allow write: if isAdmin() || canAccessUser(userId) || userId == 'nicole';
      }`;

content = content.replace(
  /match \/handicap_history\/\{historyId\} \{(?:[^{}]*|\{[^{}]*\})*\}/g,
  replacement
);

fs.writeFileSync('firestore.rules', content);

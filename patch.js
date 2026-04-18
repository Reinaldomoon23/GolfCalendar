import fs from 'fs';

let content = fs.readFileSync('api/get_handicap.js', 'utf8');

content = content.replace(
  /throw new Error\(\`HTTP Code: \$\{res\.status\}\`\);/,
  "throw new Error(`HTTP Code: ${res.status} | Text: ${await res.text()}`);"
);

fs.writeFileSync('api/get_handicap.js', content);

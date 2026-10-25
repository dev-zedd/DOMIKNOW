const fs = require('fs');
const path = require('path');

const tables = new Set();

function scan(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules') continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scan(full);
    } else if (item.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g);
      for (const m of matches) {
        tables.add(m[1]);
      }
    }
  }
}

scan('server');
const sortedTables = Array.from(tables).sort();
console.log('Total unique tables queried with .from():', sortedTables.length);
console.log(sortedTables);

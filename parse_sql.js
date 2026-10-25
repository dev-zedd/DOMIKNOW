const fs = require('fs');
const path = require('path');

const sqlDir = './database';
const sqlFiles = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql'));

const tableSchemas = {};

for (const file of sqlFiles) {
  const content = fs.readFileSync(path.join(sqlDir, file), 'utf8');
  // Match CREATE TABLE [IF NOT EXISTS] tablename (body);
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];
    tableSchemas[tableName] = {
      file: file,
      rawBody: body
    };
  }
}

console.log('Tables extracted from SQL files:', Object.keys(tableSchemas).length);
console.log(Object.keys(tableSchemas).sort());

fs.writeFileSync('parsed_sql_schemas.json', JSON.stringify(tableSchemas, null, 2));

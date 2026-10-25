const fs = require('fs');

const parsed = JSON.parse(fs.readFileSync('parsed_sql_schemas.json', 'utf8'));
const detailed = JSON.parse(fs.readFileSync('all_tables_detailed.json', 'utf8'));

console.log('Sample parsed properties:');
console.log(parsed['properties']);

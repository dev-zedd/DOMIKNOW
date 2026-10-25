require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const supabase = require('./server/config/supabaseClient');

async function extractSchemaFromCodeAndDB() {
    const auditData = JSON.parse(fs.readFileSync('db_tables_audit.json', 'utf8'));
    const tables = auditData.existingTables;

    const tableSummaries = {};

    // Read all SQL files to get exact CREATE TABLE definitions and comments
    const dbDir = path.join(__dirname, 'database');
    const sqlFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.sql'));
    const allSql = sqlFiles.map(f => fs.readFileSync(path.join(dbDir, f), 'utf8')).join('\n\n');

    for (const item of tables) {
        const tbl = item.table;
        // Fetch 1 row to see actual live columns
        const { data, error } = await supabase.from(tbl).select('*').limit(1);
        let liveCols = [];
        if (data && data.length > 0) {
            liveCols = Object.keys(data[0]);
        } else {
            liveCols = item.cols || [];
        }

        // Try to find CREATE TABLE block in allSql
        const regex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tbl}\\s*\\(([^;]+)\\);`, 'i');
        const match = allSql.match(regex);
        const sqlDefinition = match ? match[1].trim() : null;

        tableSummaries[tbl] = {
            table: tbl,
            cols: liveCols,
            sqlDefinition: sqlDefinition
        };
    }

    fs.writeFileSync('all_tables_detailed.json', JSON.stringify(tableSummaries, null, 2));
    console.log('Successfully extracted schema for', Object.keys(tableSummaries).length, 'tables!');
    process.exit(0);
}

extractSchemaFromCodeAndDB();

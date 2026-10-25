require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const supabase = require('./server/config/supabaseClient');

async function testAllTables() {
    const candidateTables = new Set();

    // 1. Scan SQL files
    const dbDir = path.join(__dirname, 'database');
    const sqlFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.sql'));
    for (const f of sqlFiles) {
        const content = fs.readFileSync(path.join(dbDir, f), 'utf8');
        const matches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi);
        for (const m of matches) {
            candidateTables.add(m[1].toLowerCase());
        }
        const alterMatches = content.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi);
        for (const m of alterMatches) {
            candidateTables.add(m[1].toLowerCase());
        }
    }

    // 2. Scan server/models
    const modelsDir = path.join(__dirname, 'server/models');
    const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
    for (const f of modelFiles) {
        const content = fs.readFileSync(path.join(modelsDir, f), 'utf8');
        const matches = content.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g);
        for (const m of matches) {
            candidateTables.add(m[1].toLowerCase());
        }
    }

    // Add additional known system tables
    candidateTables.add('policies');
    candidateTables.add('maintenance_personnel');
    candidateTables.add('landlord_workers');
    candidateTables.add('messages');
    candidateTables.add('reports');

    console.log(`Testing ${candidateTables.size} candidate tables...`);
    
    const existingTables = [];
    const missingTables = [];

    for (const table of Array.from(candidateTables).sort()) {
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
                    missingTables.push(table);
                } else {
                    // Table might exist but RLS or other condition, or it exists!
                    existingTables.push({ table, sample: data, error: error.message });
                }
            } else {
                existingTables.push({ table, sample: data, cols: data && data.length > 0 ? Object.keys(data[0]) : [] });
            }
        } catch (e) {
            missingTables.push(table);
        }
    }

    console.log('\n=== EXISTING TABLES IN DATABASE ===');
    console.log(JSON.stringify(existingTables.map(t => t.table), null, 2));

    console.log('\n=== TABLES NOT IN DATABASE (OR MISSING) ===');
    console.log(JSON.stringify(missingTables, null, 2));

    fs.writeFileSync('db_tables_audit.json', JSON.stringify({ existingTables, missingTables }, null, 2));
    process.exit(0);
}

testAllTables();

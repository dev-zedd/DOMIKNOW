require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client } = require('pg');

async function getAllTables() {
    const projectRef = 'lxbtoohaopokuenmdmia';
    const dbPassword = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD || '');
    const connectionString = process.env.DATABASE_URL || `postgres://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);
        console.log('TABLES_FOUND:', JSON.stringify(res.rows.map(r => r.table_name)));

        const cols = await client.query(`
            SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        `);
        console.log('COLUMNS_FOUND:', JSON.stringify(cols.rows));

        await client.end();
    } catch (err) {
        console.error('Error connecting to DB:', err.message);
    }
}

getAllTables();

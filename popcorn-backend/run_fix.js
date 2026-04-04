const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runFix() {
    try {
        const sql = fs.readFileSync('fix_db.sql', 'utf8');
        console.log('--- Executing Fix SQL ---');
        await pool.query(sql);
        console.log('Γ£à Database fix applied successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Γ¥î Failed to apply fix:', err.message);
        process.exit(1);
    }
}

runFix();

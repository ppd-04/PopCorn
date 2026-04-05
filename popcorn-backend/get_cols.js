require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function run() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'episodes'");
        console.log('EPISODE_COLUMNS:');
        res.rows.forEach(r => console.log('- ' + r.column_name));
    } finally {
        await pool.end();
    }
}
run();

require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'episodes'");
        console.log('EPISODE_SCHEMA:', JSON.stringify(res.rows));
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
}
run();

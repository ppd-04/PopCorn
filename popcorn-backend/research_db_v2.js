require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const epCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'episodes'");
        console.log('EPISODE_COLUMNS:', epCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
        
        const seasonCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'season'");
        console.log('SEASON_COLUMNS:', seasonCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
    } catch (e) {
        console.error('DB_ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
run();

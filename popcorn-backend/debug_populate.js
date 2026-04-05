require('dotenv').config();
const { Pool } = require('pg');

console.log('Script started');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function populate() {
    console.log('Populate function started');
    try {
        console.log('Attempting DB query...');
        const res = await pool.query('SELECT tmdb_id FROM season LIMIT 1');
        console.log('Query successful, got rows:', res.rows.length);
        
        if (res.rows.length > 0) {
            console.log('Inserting episodes...');
            // for test, just one
            const s = res.rows[0];
            await pool.query(
                `INSERT INTO episodes (series_id, season_id, episode_number, name)
                 VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                [112527, s.tmdb_id, 99, 'Test Episode']
            );
            console.log('Insert successful');
        }
    } catch (err) {
        console.error('ERROR IN POPULATE:', err);
    } finally {
        console.log('Closing pool...');
        await pool.end();
        console.log('Pool closed');
    }
}

populate().then(() => console.log('Promise resolved')).catch(e => console.error('Promise rejected:', e));

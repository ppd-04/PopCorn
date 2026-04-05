const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/popcorn' });

async function run() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('TABLES:', res.rows.map(r => r.table_name).join(', '));
        
        const hasEpisodes = res.rows.some(r => r.table_name === 'episodes');
        if (hasEpisodes) {
            const epCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'episodes'");
            console.log('EPISODE_COLUMNS:', epCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
        } else {
            console.log('EPISODES table not found');
        }
    } catch (e) {
        console.error('DB_ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
run();

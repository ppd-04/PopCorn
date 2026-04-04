const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

async function run() {
    try {
        // First inspect actual columns of movies table
        const cols = await pool.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'movies' ORDER BY ordinal_position`);
        console.log("MOVIES TABLE COLUMNS:");
        cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) nullable=${r.is_nullable}`));
        console.log();
        
        // Test a trial insert
        const testInsert = await pool.query(`
            INSERT INTO movies (tmdb_id, title, overview, poster_path, original_language, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id, title
        `, [99999998, 'Test Movie Delete Me', 'Test overview', '/test.jpg', 'en']);
        console.log("Trial insert SUCCESS:", testInsert.rows[0]);
        
        // Clean it up
        await pool.query(`DELETE FROM movies WHERE tmdb_id = $1`, [99999998]);
        console.log("Cleaned up test row.");
    } catch (err) {
        console.error("EXACT ERROR:", err.message);
        console.error("Detail:", err.detail);
        console.error("Code:", err.code);
    } finally {
        pool.end();
    }
}
run();

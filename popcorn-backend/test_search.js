require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runSetup() {
    try {
        const query = `
            SELECT user_id, username, full_name, profile_picture 
            FROM users 
            WHERE username ILIKE $1 OR full_name ILIKE $1 
            LIMIT 20
        `;
        const result = await pool.query(query, ['%b%', '%b%']); // testing with 'b'
        console.log("SEARCH RESULTS:", result.rows);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
runSetup();

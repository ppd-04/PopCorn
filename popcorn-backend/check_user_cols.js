require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runSetup() {
    try {
        const result = await pool.query("SELECT * FROM users LIMIT 1");
        console.log("USER COLUMNS:");
        console.log(Object.keys(result.rows[0]));
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
runSetup();

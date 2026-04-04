require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query(`SELECT * FROM serieses LIMIT 1`);
        if (res.rows.length > 0) {
            console.log("Serieses Columns:", Object.keys(res.rows[0]));
        } else {
            console.log("Serieses table is empty");
        }
        
        const res2 = await pool.query(`SELECT * FROM movies LIMIT 1`);
        if (res2.rows.length > 0) {
            console.log("Movies Columns:", Object.keys(res2.rows[0]));
        } else {
            console.log("Movies table is empty");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();

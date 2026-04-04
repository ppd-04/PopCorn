const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

async function run() {
    try {
        await pool.query(`UPDATE users SET is_admin = true, is_super_admin = true WHERE email = 'fahmid0403@outlook.com'`);
        console.log("Elevated Fahmid to SuperAdmin!");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}
run();

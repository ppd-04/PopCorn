const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

async function run() {
    try {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP WITH TIME ZONE;`);
        console.log("Added is_super_admin and banned_until to users table.");
        
        await pool.query(`UPDATE users SET is_admin = true, is_super_admin = true WHERE email = 'fahmid0403@outlook.com'`);
        console.log("Elevated fahmid0403 to superadmin!");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}
run();

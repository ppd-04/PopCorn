const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query("SELECT user_id, username, email, is_admin, is_super_admin FROM users WHERE email = 'fahmid0403@outlook.com'");
        console.log('SuperAdmin Data:', JSON.stringify(res.rows, null, 2));
        
        // Also check if there are other admins to test against
        const admins = await pool.query("SELECT user_id, username, is_admin, is_super_admin FROM users WHERE is_admin = true AND email != 'fahmid0403@outlook.com' LIMIT 5");
        console.log('Other Admins:', JSON.stringify(admins.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
run();

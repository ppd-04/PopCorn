const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query("SELECT user_id, email, is_admin, is_super_admin, is_verified FROM users WHERE email = 'fahmid0403@outlook.com'");
        console.log(JSON.stringify(res.rows, null, 2));

        const notifCount = await pool.query("SELECT COUNT(*) FROM notifications");
        console.log('Total notifications:', notifCount.rows[0].count);

        const someNotifs = await pool.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5");
        console.log('Recent 5 notifications:', JSON.stringify(someNotifs.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
run();

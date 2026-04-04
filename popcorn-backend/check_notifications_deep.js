const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('--- Checking User 4 (current user in logs) ---');
        const user4 = await pool.query("SELECT user_id, username, email FROM users WHERE user_id = 4");
        console.log('User 4:', JSON.stringify(user4.rows, null, 2));

        const user4Notifs = await pool.query("SELECT * FROM notifications WHERE user_id = 4");
        console.log(`User 4 Notifications Count: ${user4Notifs.rows.length}`);
        console.log('User 4 Notifications:', JSON.stringify(user4Notifs.rows, null, 2));

        console.log('\n--- Checking All Notifications ---');
        const allNotifs = await pool.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10");
        console.log('All Notifications (Recent 10):', JSON.stringify(allNotifs.rows, null, 2));

        console.log('\n--- Checking Table Schema ---');
        const schema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notifications'
        `);
        console.log('Notifications Schema:', JSON.stringify(schema.rows, null, 2));

    } catch (err) {
        console.error('Diagnostic error:', err);
    } finally {
        pool.end();
    }
}
run();

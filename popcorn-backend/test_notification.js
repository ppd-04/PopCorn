const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const userId = 4; // current user
        const senderId = 3; // system/admin
        const type = 'system';
        const message = '🚀 PopCorn Notification Fix: This is a real-time test notification!';
        
        const res = await pool.query(
            `INSERT INTO notifications (user_id, sender_id, type, message, created_at, is_read) 
             VALUES ($1, $2, $3, $4, NOW(), false) RETURNING *`,
            [userId, senderId, type, message]
        );
        console.log('Inserted test notification:', JSON.stringify(res.rows[0], null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
run();

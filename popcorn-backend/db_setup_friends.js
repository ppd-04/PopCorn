require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runSetup() {
    try {
        console.log("Creating tables...");
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS friend_requests (
                id SERIAL PRIMARY KEY,
                requester_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                receiver_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending', 
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(requester_id, receiver_id)
            );
        `);
        console.log("✅ friend_requests table checked/created.");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                message TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                related_id INTEGER -- could be friend_request_id or post_id
            );
        `);
        console.log("✅ notifications table checked/created.");

    } catch(e) {
        console.error("❌ Error setting up database:", e);
    } finally {
        pool.end();
    }
}
runSetup();

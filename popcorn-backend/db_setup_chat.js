require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runSetup() {
    try {
        console.log("Creating social chat tables...");
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS direct_messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                receiver_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                read_at TIMESTAMPTZ
            );
        `);
        console.log("✅ direct_messages table checked/created.");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS discussions (
                id SERIAL PRIMARY KEY,
                creator_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                movie_id INTEGER,
                title VARCHAR(255) NOT NULL,
                access_level VARCHAR(20) DEFAULT 'public', -- 'public', 'friends', 'invite'
                max_participants INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log("✅ discussions table checked/created.");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS discussion_participants (
                discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
                joined_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (discussion_id, user_id)
            );
        `);
        console.log("✅ discussion_participants table checked/created.");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS discussion_messages (
                id SERIAL PRIMARY KEY,
                discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
                sender_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log("✅ discussion_messages table checked/created.");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS discussion_invites (
                discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
                inviter_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                invitee_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (discussion_id, invitee_id)
            );
        `);
        console.log("✅ discussion_invites table checked/created.");

    } catch(e) {
        console.error("❌ Error setting up database:", e);
    } finally {
        pool.end();
    }
}
runSetup();

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                reporter_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                post_id INTEGER REFERENCES social_posts(post_id) ON DELETE CASCADE,
                comment_id INTEGER REFERENCES post_comments(comment_id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ Reports table created successfully.');
    } catch (err) {
        console.error('❌ Error creating reports table:', err);
    } finally {
        pool.end();
    }
}
run();

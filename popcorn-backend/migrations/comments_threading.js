const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log('Adding parent_id to comment tables...');
        
        await pool.query('ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES post_comments(comment_id) ON DELETE CASCADE');
        console.log('Done: post_comments');
        
        await pool.query('ALTER TABLE movie_comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES movie_comments(comment_id) ON DELETE CASCADE');
        console.log('Done: movie_comments');
        
        await pool.query('ALTER TABLE series_comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES series_comments(comment_id) ON DELETE CASCADE');
        console.log('Done: series_comments');
        
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();

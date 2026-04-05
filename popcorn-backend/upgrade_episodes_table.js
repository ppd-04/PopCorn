require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function upgrade() {
    try {
        console.log('--- Upgrading episodes table schema ---');
        
        // 1. Add missing columns
        await pool.query(`
            ALTER TABLE episodes 
            ADD COLUMN IF NOT EXISTS season_number INTEGER,
            ADD COLUMN IF NOT EXISTS episode_number INTEGER,
            ADD COLUMN IF NOT EXISTS overview TEXT,
            ADD COLUMN IF NOT EXISTS air_date DATE,
            ADD COLUMN IF NOT EXISTS still_path TEXT,
            ADD COLUMN IF NOT EXISTS vote_average NUMERIC,
            ADD COLUMN IF NOT EXISTS vote_count INTEGER;
        `);
        
        // 2. Rename columns for consistency if they exist
        try {
            await pool.query('ALTER TABLE episodes RENAME COLUMN episodeid TO episode_id;');
        } catch (e) { /* ignore if already renamed */ }
        
        try {
            await pool.query('ALTER TABLE episodes RENAME COLUMN episode_name TO name;');
        } catch (e) { /* ignore if already renamed */ }
        
        try {
            await pool.query('ALTER TABLE episodes RENAME COLUMN ratings TO vote_average_legacy;');
        } catch (e) { /* ignore if already renamed */ }

        console.log('--- Schema upgrade complete ---');
    } catch (e) {
        console.error('Upgrade Error:', e.message);
    } finally {
        await pool.end();
    }
}
upgrade();

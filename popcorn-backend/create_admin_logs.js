const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});

async function run() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS admin_activity_logs (
                log_id SERIAL PRIMARY KEY,
                admin_id INTEGER,
                action_type VARCHAR(100) NOT NULL,
                target_entity VARCHAR(50) NOT NULL,
                target_id INTEGER,
                details TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;
        await pool.query(query);
        console.log("admin_activity_logs table created successfully.");
        
        await pool.query(`UPDATE users SET is_admin = true, is_super_admin = true WHERE email = 'fahmid0403@outlook.com'`);
        console.log("Elevated fahmid0403 to superadmin!");
    } catch (err) {
        console.error("Error creating table:", err);
    } finally {
        pool.end();
    }
}
run();

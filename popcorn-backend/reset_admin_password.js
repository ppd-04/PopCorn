const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function resetPassword() {
    const email = 'fahmid0403@outlook.com';
    const newPassword = 'admin123';
    
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const res = await pool.query(
            "UPDATE users SET password = $1, is_verified = true WHERE email = $2 RETURNING user_id",
            [hashedPassword, email]
        );
        
        if (res.rowCount > 0) {
            console.log(`Successfully reset password for ${email} to 'admin123'`);
        } else {
            console.log(`User ${email} not found.`);
        }
    } catch (err) {
        console.error('Error resetting password:', err);
    } finally {
        pool.end();
    }
}

resetPassword();

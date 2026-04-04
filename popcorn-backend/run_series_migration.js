const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
process.chdir(__dirname);
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        await client.connect();
        const sql = fs.readFileSync('series_details_migration.sql', 'utf8');
        await client.query(sql);
        console.log('Migration successful');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await client.end();
    }
})();

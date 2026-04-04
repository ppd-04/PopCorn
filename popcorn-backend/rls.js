const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        await client.connect();
        await client.query("ALTER TABLE people DISABLE ROW LEVEL SECURITY;");
        await client.query("ALTER TABLE serieses DISABLE ROW LEVEL SECURITY;");
        console.log("Disabled RLS for both tables!");
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.end();
    }
})();

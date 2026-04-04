const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        await client.connect();
        let res = await client.query('SELECT count(*) FROM serieses');
        console.log('Series count:', res.rows[0].count);
        let res2 = await client.query('SELECT count(*) FROM people');
        console.log('People count:', res2.rows[0].count);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.end();
    }
})();

process.chdir(__dirname);
require('dotenv').config();
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect()
  .then(async () => {
    const r1 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='seasons' ORDER BY ordinal_position");
    console.log('seasons columns:', r1.rows.map(x => x.column_name).join(', '));
    const r2 = await c.query("SELECT * FROM seasons LIMIT 1");
    if (r2.rows.length > 0) console.log('Sample seasons row:', JSON.stringify(r2.rows[0]));
  })
  .catch(e => console.error(e.message))
  .finally(() => c.end());

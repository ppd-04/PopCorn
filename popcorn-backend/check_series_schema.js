process.chdir(__dirname);
require('dotenv').config();
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect()
  .then(async () => {
    const r1 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='serieses' ORDER BY ordinal_position");
    console.log('serieses columns:', r1.rows.map(x => x.column_name).join(', '));
    
    // Check if seasons table exists
    const r2 = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%season%'");
    console.log('Season-related tables:', r2.rows.map(x => x.table_name).join(', ') || 'none');
    
    // Sample a row from serieses
    const r3 = await c.query("SELECT * FROM serieses LIMIT 1");
    if (r3.rows.length > 0) console.log('Sample serieses row keys:', Object.keys(r3.rows[0]).join(', '));
  })
  .catch(e => console.error(e.message))
  .finally(() => c.end());

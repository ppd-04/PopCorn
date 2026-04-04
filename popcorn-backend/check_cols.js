process.chdir(__dirname);
require('dotenv').config();
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect()
  .then(() => c.query("SELECT column_name FROM information_schema.columns WHERE table_name='serieses' ORDER BY ordinal_position LIMIT 15"))
  .then(r => console.log('Columns:', r.rows.map(x => x.column_name).join(', ')))
  .catch(e => console.error(e.message))
  .finally(() => c.end());

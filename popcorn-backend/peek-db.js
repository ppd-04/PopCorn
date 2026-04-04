const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const fs = require('fs');

async function peek() {
    let output = '';
    try {
        const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const tables = tablesRes.rows.map(r => r.table_name);
        output += 'TABLES: ' + tables.join(', ') + '\n\n';
        
        for (const table of tables) {
            const colsRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`, [table]);
            output += `\nTable ${table}:\n`;
            output += colsRes.rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n') + '\n';
        }
        fs.writeFileSync('schema.txt', output, 'utf8');
        console.log('Schema written to schema.txt');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}
peek();

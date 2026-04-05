require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function populate() {
    try {
        console.log('--- Starting Episode Population (V3) ---');
        
        // 1. Get seasons that have a valid series backlink
        const seasonRes = await pool.query(`
            SELECT s.series_id, s.season_number, s.tmdb_id as season_id
            FROM season s
            JOIN serieses ser ON s.series_id = ser.tmdb_id
            LIMIT 20
        `);

        console.log(`Found ${seasonRes.rows.length} valid seasons.`);

        if (seasonRes.rows.length === 0) {
            console.log('No valid seasons found to populate episodes for.');
            return;
        }

        let totalInserted = 0;
        const targetCount = 100;

        for (const season of seasonRes.rows) {
            if (totalInserted >= targetCount) break;

            const episodesToCreate = 10; 
            console.log(`Creating ${episodesToCreate} episodes for Series ${season.series_id} Season ${season.season_number}...`);

            for (let i = 1; i <= episodesToCreate; i++) {
                const epNum = i;
                const name = `Episode ${epNum}: The Reveal`;
                const overview = `Mystery unfolds in episode ${epNum} of season ${season.season_number}. A sudden turn of events leaves the viewers in shock.`;
                const airDate = new Date(2022, season.season_number, epNum).toISOString().split('T')[0];
                const voteAvg = (Math.random() * 1.5 + 8.0).toFixed(1);
                const voteCount = Math.floor(Math.random() * 300 + 150);

                await pool.query(
                    `INSERT INTO episodes (series_id, season_number, episode_number, name, overview, air_date, vote_average, vote_count)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT DO NOTHING`,
                    [season.series_id, season.season_number, epNum, name, overview, airDate, voteAvg, voteCount]
                );
                totalInserted++;
            }
        }

        console.log(`--- Finished! Total episodes inserted: ${totalInserted} ---`);
    } catch (err) {
        console.error('Population Error:', err.message);
    } finally {
        await pool.end();
    }
}

populate();

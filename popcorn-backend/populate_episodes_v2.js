require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function populate() {
    try {
        console.log('--- Starting Episode Population (V2) ---');
        
        // 1. Get existing seasons
        const seasonRes = await pool.query('SELECT series_id, season_number FROM season LIMIT 20');
        if (seasonRes.rows.length === 0) {
            console.log('No seasons found to populate episodes for.');
            return;
        }

        let totalInserted = 0;
        const targetCount = 100;

        for (const season of seasonRes.rows) {
            if (totalInserted >= targetCount) break;

            const episodesToCreate = Math.min(10, Math.ceil((targetCount - totalInserted) / (seasonRes.rows.length - totalInserted/10)));
            console.log(`Creating ${episodesToCreate} episodes for Series ${season.series_id} Season ${season.season_number}...`);

            for (let i = 1; i <= episodesToCreate; i++) {
                const epNum = i;
                const name = `Episode ${epNum}: The Next Chapter`;
                const overview = `Detailed overview for episode ${epNum} of season ${season.season_number}. As tensions rise, secrets are revealed.`;
                const airDate = new Date(2021 + season.season_number, 0, epNum).toISOString().split('T')[0];
                const voteAvg = (Math.random() * 2 + 7.8).toFixed(1);
                const voteCount = Math.floor(Math.random() * 200 + 100);

                await pool.query(
                    `INSERT INTO episodes (series_id, season_number, episode_number, name, overview, air_date, vote_average, vote_count)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT DO NOTHING`,
                    [season.series_id, season.season_number, epNum, name, overview, airDate, voteAvg, voteCount]
                );
                totalInserted++;
            }
        }

        console.log(`--- Finished! Total episodes in DB: ${totalInserted} ---`);
    } catch (err) {
        console.error('Population Error:', err.message);
    } finally {
        await pool.end();
    }
}

populate();

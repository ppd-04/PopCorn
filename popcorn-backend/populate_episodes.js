require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function populate() {
    try {
        console.log('--- Starting Episode Population ---');
        console.log('DB URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
        
        // 1. Get existing seasons
        const seasonRes = await pool.query('SELECT tmdb_id, series_id, season_number FROM season LIMIT 20');
        console.log(`Found ${seasonRes.rows.length} seasons.`);

        if (seasonRes.rows.length === 0) {
            console.log('No seasons found to populate episodes for.');
            return;
        }

        let totalInserted = 0;
        const targetCount = 100;

        for (const season of seasonRes.rows) {
            console.log(`Checking Season TMDB ID: ${season.tmdb_id}, Series ID: ${season.series_id}`);
            if (totalInserted >= targetCount) break;

            const episodesToCreate = Math.min(10, targetCount - totalInserted);
            console.log(`Creating ${episodesToCreate} episodes for Series ${season.series_id} Season ${season.season_number}...`);

            for (let i = 1; i <= episodesToCreate; i++) {
                const epNum = i;
                const name = `Episode ${epNum}: The Genesis`;
                const overview = `This is a sample overview for episode ${epNum} of season ${season.season_number}. The plot thickens as characters navigate complex situations.`;
                const airDate = new Date(2020 + season.season_number, 0, epNum).toISOString().split('T')[0];
                const voteAvg = (Math.random() * 2 + 7.5).toFixed(1);
                const voteCount = Math.floor(Math.random() * 100 + 50);

                await pool.query(
                    `INSERT INTO episodes (series_id, season_id, episode_number, name, overview, air_date, vote_average, vote_count)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT DO NOTHING`,
                    [season.series_id, season.tmdb_id, epNum, name, overview, airDate, voteAvg, voteCount]
                );
                totalInserted++;
            }
        }

        console.log(`--- Finished! Inserted ${totalInserted} episodes ---`);
    } catch (err) {
        console.error('Population Error:', err.message);
    } finally {
        await pool.end();
    }
}

populate();

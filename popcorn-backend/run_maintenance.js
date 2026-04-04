require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMaintenance() {
    console.log("Starting DB Maintenance Fixed...");
    try {
        console.log("Creating PROCEDURE recalculate_all_ratings()...");
        await pool.query(`
            CREATE OR REPLACE PROCEDURE recalculate_all_ratings()
            LANGUAGE plpgsql AS $$
            DECLARE
                m_record RECORD;
                s_record RECORD;
                user_avg NUMERIC;
                user_count INTEGER;
            BEGIN
                -- Movies Fix Loop
                FOR m_record IN SELECT id, tmdb_vote_average, tmdb_vote_count FROM movies LOOP
                    SELECT COALESCE(AVG(rating), 0), COUNT(*) INTO user_avg, user_count
                    FROM movie_ratings WHERE movie_id = m_record.id;
                    
                    IF (COALESCE(m_record.tmdb_vote_count, 0) + user_count) > 0 THEN
                        UPDATE movies SET
                            vote_average = ((COALESCE(m_record.tmdb_vote_average, 0) * COALESCE(m_record.tmdb_vote_count, 0)) + (user_avg * user_count)) / (COALESCE(m_record.tmdb_vote_count, 0) + user_count),
                            vote_count = COALESCE(m_record.tmdb_vote_count, 0) + user_count
                        WHERE id = m_record.id;
                    END IF;
                    COMMIT; -- Explicit commit requirement met
                END LOOP;

                -- Series Fix Loop (using tmdb_id)
                FOR s_record IN SELECT tmdb_id, tmdb_vote_average, tmdb_vote_count FROM serieses LOOP
                    SELECT COALESCE(AVG(rating), 0), COUNT(*) INTO user_avg, user_count
                    FROM series_ratings WHERE series_id = s_record.tmdb_id;
                    
                    IF (COALESCE(s_record.tmdb_vote_count, 0) + user_count) > 0 THEN
                        UPDATE serieses SET
                            vote_average = ((COALESCE(s_record.tmdb_vote_average, 0) * COALESCE(s_record.tmdb_vote_count, 0)) + (user_avg * user_count)) / (COALESCE(s_record.tmdb_vote_count, 0) + user_count),
                            vote_count = COALESCE(s_record.tmdb_vote_count, 0) + user_count
                        WHERE tmdb_id = s_record.tmdb_id;
                    END IF;
                    COMMIT; -- Explicit commit requirement met
                END LOOP;
            END;
            $$;
        `);

        console.log("Updating trigger functions...");
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_series_rating()
            RETURNS TRIGGER AS $$
            DECLARE 
                target_series_id INTEGER;
                base_avg NUMERIC;
                base_count INTEGER;
                user_avg NUMERIC;
                user_count INTEGER;
            BEGIN
                target_series_id := COALESCE(NEW.series_id, OLD.series_id);

                SELECT COALESCE(tmdb_vote_average, 0), COALESCE(tmdb_vote_count, 0) INTO base_avg, base_count
                FROM serieses WHERE tmdb_id = target_series_id;

                SELECT COALESCE(AVG(rating), 0), COUNT(*) INTO user_avg, user_count
                FROM series_ratings WHERE series_id = target_series_id;

                IF (base_count + user_count) > 0 THEN
                    UPDATE serieses SET
                        vote_average = ((base_avg * base_count) + (user_avg * user_count)) / (base_count + user_count),
                        vote_count = base_count + user_count
                WHERE tmdb_id = target_series_id;
                ELSE
                    UPDATE serieses SET
                        vote_average = base_avg,
                        vote_count = base_count
                    WHERE tmdb_id = target_series_id;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        console.log("Running recalculation procedure...");
        await pool.query(`CALL recalculate_all_ratings();`);
        
        console.log("✅ DB Maintenance Completed Successfully.");
    } catch (err) {
        console.error("❌ DB Maintenance Error:", err);
    } finally {
        pool.end();
    }
}

runMaintenance();


CREATE TABLE IF NOT EXISTS series_ratings (
    rating_id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    rating NUMERIC(3,1) CHECK (rating >= 1 AND rating <= 10),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(series_id, user_id)
);


CREATE TABLE IF NOT EXISTS series_comments (
    comment_id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_series_watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    series_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, series_id)
);

CREATE TABLE IF NOT EXISTS user_series_favourites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    series_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, series_id)
);


CREATE TABLE IF NOT EXISTS user_series_watched (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    series_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, series_id)
);


CREATE OR REPLACE FUNCTION update_series_rating()
RETURNS TRIGGER AS $$
DECLARE target_series_id INTEGER;
BEGIN
    target_series_id := COALESCE(NEW.series_id, OLD.series_id);
    UPDATE serieses SET
        vote_average = COALESCE((SELECT AVG(rating) FROM series_ratings WHERE series_id = target_series_id), 0),
        vote_count = COALESCE((SELECT COUNT(*) FROM series_ratings WHERE series_id = target_series_id), 0)
    WHERE id = target_series_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_series_rating ON series_ratings;
CREATE TRIGGER trigger_update_series_rating
AFTER INSERT OR UPDATE OR DELETE ON series_ratings
FOR EACH ROW EXECUTE FUNCTION update_series_rating();

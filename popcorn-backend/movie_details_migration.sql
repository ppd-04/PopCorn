
CREATE TABLE IF NOT EXISTS movie_ratings (
    rating_id SERIAL PRIMARY KEY,
    movie_id INTEGER NOT NULL,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    rating NUMERIC(3,1) CHECK (rating >= 1 AND rating <= 10),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(movie_id, user_id)
);


CREATE TABLE IF NOT EXISTS movie_comments (
    comment_id SERIAL PRIMARY KEY,
    movie_id INTEGER NOT NULL,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_favourites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);


CREATE TABLE IF NOT EXISTS user_watched (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);


CREATE OR REPLACE FUNCTION update_movie_rating()
RETURNS TRIGGER AS $$
DECLARE target_movie_id INTEGER;
BEGIN
    target_movie_id := COALESCE(NEW.movie_id, OLD.movie_id);
    UPDATE movies SET
        vote_average = COALESCE((SELECT AVG(rating) FROM movie_ratings WHERE movie_id = target_movie_id), 0),
        vote_count = COALESCE((SELECT COUNT(*) FROM movie_ratings WHERE movie_id = target_movie_id), 0)
    WHERE id = target_movie_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_movie_rating ON movie_ratings;
CREATE TRIGGER trigger_update_movie_rating
AFTER INSERT OR UPDATE OR DELETE ON movie_ratings
FOR EACH ROW EXECUTE FUNCTION update_movie_rating();

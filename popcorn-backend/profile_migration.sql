
CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);

CREATE TABLE IF NOT EXISTS favourite_people (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL,
    person_name VARCHAR(255) NOT NULL,
    person_role VARCHAR(100), -- 'Actor', 'Director', etc.
    profile_path TEXT, -- TMDB profile image path
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, person_id)
);


CREATE TABLE IF NOT EXISTS user_interests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, genre_id)
);

CREATE TABLE IF NOT EXISTS user_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, 
    movie_id INTEGER,
    details TEXT, -- e.g. 'Rated 8/10'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION log_rating_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_activity (user_id, activity_type, movie_id, details)
    VALUES (NEW.user_id, 'rated', NEW.movie_id, 'Rated ' || NEW.rating || '/10');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_rating_activity ON movie_ratings;
CREATE TRIGGER trigger_log_rating_activity
AFTER INSERT OR UPDATE ON movie_ratings
FOR EACH ROW EXECUTE FUNCTION log_rating_activity();

CREATE OR REPLACE FUNCTION log_watchlist_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_activity (user_id, activity_type, movie_id, details)
        VALUES (NEW.user_id, 'watchlist_add', NEW.movie_id, 'Added to watchlist');
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO user_activity (user_id, activity_type, movie_id, details)
        VALUES (OLD.user_id, 'watchlist_remove', OLD.movie_id, 'Removed from watchlist');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_watchlist_activity ON watchlist;
CREATE TRIGGER trigger_log_watchlist_activity
AFTER INSERT OR DELETE ON watchlist
FOR EACH ROW EXECUTE FUNCTION log_watchlist_activity();


CREATE OR REPLACE FUNCTION log_favourite_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_activity (user_id, activity_type, movie_id, details)
        VALUES (NEW.user_id, 'favourite_add', NEW.movie_id, 'Added to favourites');
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO user_activity (user_id, activity_type, movie_id, details)
        VALUES (OLD.user_id, 'favourite_remove', OLD.movie_id, 'Removed from favourites');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_favourite_activity ON user_favourites;
CREATE TRIGGER trigger_log_favourite_activity
AFTER INSERT OR DELETE ON user_favourites
FOR EACH ROW EXECUTE FUNCTION log_favourite_activity();

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Link } from 'react-router-dom';

const GENRE_LIMIT = 10; // movies per genre row

const GenreRows = () => {
  const [genreData, setGenreData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGenresWithMovies() {
      setLoading(true);
      try {
        // Fetch all genres
        const { data: genres, error: genreError } = await supabase
          .from('genres')
          .select('*')
          .order('name');

        if (genreError || !genres) {
          console.error('Error fetching genres:', genreError);
          setLoading(false);
          return;
        }

        // For each genre, fetch top movies
        const results = [];
        for (const genre of genres) {
          const { data: movieGenres, error: mgError } = await supabase
            .from('movie_genres')
            .select('movie_id')
            .eq('genre_id', genre.id)
            .limit(GENRE_LIMIT);

          if (mgError || !movieGenres || movieGenres.length === 0) continue;

          const movieIds = movieGenres.map(mg => mg.movie_id);

          const { data: movies, error: movieError } = await supabase
            .from('movies')
            .select('id, title, poster_path, vote_average, release_date')
            .in('id', movieIds)
            .order('vote_average', { ascending: false });

          if (movieError || !movies || movies.length === 0) continue;

          results.push({
            genre: genre.name,
            genreId: genre.id,
            movies: movies
          });
        }

        setGenreData(results);
      } catch (err) {
        console.error('GenreRows fetch error:', err);
      }
      setLoading(false);
    }

    fetchGenresWithMovies();
  }, []);

  if (loading) {
    return (
      <div className="genre-rows-section">
        {[1, 2, 3].map(i => (
          <div key={i} className="genre-row">
            <div className="genre-row-header">
              <h3 style={{ background: 'rgba(255,255,255,0.06)', width: '200px', height: '28px', borderRadius: '8px' }}>&nbsp;</h3>
            </div>
            <div className="genre-row-loading">
              {[1,2,3,4,5,6].map(j => (
                <div key={j} className="genre-card-skeleton" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (genreData.length === 0) return null;

  return (
    <div className="genre-rows-section">
      {genreData.map((row, idx) => (
        <GenreRowItem key={row.genreId} row={row} delay={idx * 100} />
      ))}
    </div>
  );
};

const GenreRowItem = ({ row, delay }) => {
  const scrollRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const scroll = useCallback((direction) => {
    if (scrollRef.current) {
      const amount = 440;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth'
      });
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="genre-row" style={{ animationDelay: `${delay}ms` }}>
      <div className="genre-row-header">
        <h3>
          {row.genre}
          <span className="genre-count"> • {row.movies.length} titles</span>
        </h3>
      </div>
      <div className="genre-scroll-wrapper">
        <button className="genre-scroll-btn left" onClick={() => scroll('left')}>‹</button>
        <div className="genre-scroll-container" ref={scrollRef}>
          {row.movies.map(movie => {
            const imageUrl = movie.poster_path
              ? (movie.poster_path.startsWith('http')
                ? movie.poster_path
                : `https://image.tmdb.org/t/p/w300${movie.poster_path}`)
              : null;
            const year = movie.release_date ? movie.release_date.split('-')[0] : '';

            return (
              <Link
                to={`/movie/${movie.id}`}
                key={movie.id}
                className="genre-movie-card"
                style={{ textDecoration: 'none' }}
              >
                <div className="genre-movie-poster">
                  {imageUrl ? (
                    <img src={imageUrl} alt={movie.title} />
                  ) : (
                    <div className="no-poster">🎬</div>
                  )}
                  {movie.vote_average > 0 && (
                    <div className="genre-movie-rating">
                      ⭐ {movie.vote_average.toFixed(1)}
                    </div>
                  )}
                </div>
                <div className="genre-movie-info">
                  <h4>{movie.title}</h4>
                  <span>{year}</span>
                </div>
              </Link>
            );
          })}
        </div>
        <button className="genre-scroll-btn right" onClick={() => scroll('right')}>›</button>
      </div>
    </div>
  );
};

export default GenreRows;

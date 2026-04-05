import React, { useState, useEffect } from 'react';
import supabase from './supabaseClient';
import MovieCard from './MovieCard';

function MoviesPage() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    async function fetchAllMovies() {

      const { data, error } = await supabase
        .from('Movies')
        .select('*');

      if (error) {
        console.error("Error fetching movies:", error);
      } else {
        setMovies(data);
      }
    }

    fetchAllMovies();
  }, []);

  return (
    <div className="movies-page-container">
      <h2 style={{ textAlign: 'center', color: '#ffc107', marginTop: '20px' }}>PopCorn Database</h2>
      <div className="movie-grid">
        {movies.map(movie => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </div>
  );
}

export default MoviesPage;
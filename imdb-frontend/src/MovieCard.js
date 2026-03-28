import React from 'react';

function MovieCard({ movie }) {
  return (
    <div className="movie-card">
      <div className="movie-poster">
        <img src={movie.poster} alt={movie.title} />
      </div>
      <h3>{movie.title}</h3>
      <div className="movie-rating">★ {movie.rating}</div>
    </div>
  );
}

export default MovieCard;

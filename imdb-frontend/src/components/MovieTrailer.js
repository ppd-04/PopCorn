import React, { useState, useEffect } from 'react';

const MovieTrailer = ({ movieId }) => {
  const [trailerKey, setTrailerKey] = useState(null);

  useEffect(() => {
    async function fetchTrailer() {

      if (!movieId) return; 

      try {

        const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=ffb76769eee5be098b949fd3877a9d0b`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          // Look for the official YouTube trailer
          const officialTrailer = data.results.find(
            (vid) => vid.site === "YouTube" && vid.type === "Trailer"
          );

          if (officialTrailer) { 
            setTrailerKey(officialTrailer.key);
          } else {
 
            const fallbackVideo = data.results.find((vid) => vid.site === "YouTube");
            if (fallbackVideo) setTrailerKey(fallbackVideo.key);
          }
        }
      } catch (error) {
        console.error("Error fetching trailer:", error);
      }
    }

    fetchTrailer();
  }, [movieId]); 

  if (!trailerKey) return null; 

  return (
    <div className="trailer-section" style={{ marginTop: '40px' }}>
      <h3 style={{ color: '#ffc107', marginBottom: '20px', fontSize: '1.5rem' }}>Official Trailer</h3>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
        <iframe 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          src={`https://www.youtube.com/embed/${trailerKey}`} 
          title="YouTube video player" 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
};

export default MovieTrailer;
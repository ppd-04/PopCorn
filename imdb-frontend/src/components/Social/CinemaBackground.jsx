import React, { useState, useEffect } from 'react';

const CinemaBackground = ({ posterPath }) => {
  const [currentPoster, setCurrentPoster] = useState(null);
  const [nextPoster, setNextPoster] = useState(null);
  const [isFading, setIsFading] = useState(false);

  // Fallback background image (PopCorn themed)
  const FALLBACK = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop";

  useEffect(() => {
    // TMDB posterPath usually has a leading /
    const path = posterPath ? (posterPath.startsWith('/') ? posterPath : '/' + posterPath) : null;
    const fullPath = path ? `https://image.tmdb.org/t/p/original${path}` : FALLBACK;
    
    if (fullPath === currentPoster) return;

    if (!currentPoster) {
      setCurrentPoster(fullPath);
      console.log("CinemaBackground: Initialized with", fullPath);
    } else {
      console.log("CinemaBackground: Fading to", fullPath);
      setNextPoster(fullPath);
      setIsFading(true);
      
      const timer = setTimeout(() => {
        setCurrentPoster(fullPath);
        setNextPoster(null);
        setIsFading(false);
      }, 2000); 
      
      return () => clearTimeout(timer);
    }
  }, [posterPath, currentPoster]);

  return (
    <div className="cinema-background-wrapper">
      {/* Current Layer */}
      {currentPoster && (
        <div 
          className="cinema-bg-layer" 
          style={{ 
            backgroundImage: `url(${currentPoster})`,
            opacity: isFading ? 0 : 1
          }} 
        />
      )}
      
      {/* Next Layer (Fading In) */}
      {nextPoster && (
        <div 
          className="cinema-bg-layer" 
          style={{ 
            backgroundImage: `url(${nextPoster})`,
            opacity: isFading ? 1 : 0
          }} 
        />
      )}

      {/* Glassmorphism Overlay */}
      <div className="cinema-bg-overlay" />
    </div>
  );
};

export default CinemaBackground;

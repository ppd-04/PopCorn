import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './BrowsePage.css';

const BrowsePage = ({ user }) => {
  const [trending, setTrending] = useState([]);
  const [collaborative, setCollaborative] = useState([]);
  const [foryou, setForyou] = useState([]);
  const [related, setRelated] = useState([]);
  const [aiRecs, setAiRecs] = useState([]);
  const [anchorTitle, setAnchorTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [aiSlide, setAiSlide] = useState(0);
  const navigate = useNavigate();
  const spotlightTimerRef = useRef(null);
  const aiCarouselTimerRef = useRef(null);

  // Utility to shuffle array
  const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const fetchAiRecs = useCallback(async (force = false) => {
    if (!user) return;
    setIsAiLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`http://localhost:5000/api/browse/ai?force=${force}&t=${Date.now()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const recommendations = (data.recommendations || []).map(rec => ({
          ...rec,
          ai_note: rec.ai_note ? rec.ai_note.replace(/\*\*/g, '') : ''
        }));
        setAiRecs(shuffleArray(recommendations));
      }
    } catch (err) {
      console.error('[Browse] AI fetch error:', err);
    } finally {
      setIsAiLoading(false);
    }
  }, [user]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const timestamp = Date.now();

        // Trending: Get 50, shuffle, take 15 for rows, first 5 of those for spotlight
        const trendRes = await fetch(`http://localhost:5000/api/browse/trending?t=${timestamp}`);
        if (trendRes.ok) {
          const data = await trendRes.json();
          const shuffled = shuffleArray(data);
          console.log(`[Browse] Trending received: ${data.length} movies. Shuffling now.`);
          setTrending(shuffled);
        }

        // Collaborative: Always fetch, shuffle for variety
        const collabRes = await fetch(`http://localhost:5000/api/browse/collaborative?t=${timestamp}`, { headers });
        if (collabRes.ok) {
          const data = await collabRes.json();
          console.log(`[Browse] Collaborative received: ${data.length} movies.`);
          setCollaborative(shuffleArray(data));
        }

        // For You: Always fetch, shuffle for variety
        const foryouRes = await fetch(`http://localhost:5000/api/browse/foryou?t=${timestamp}`, { headers });
        if (foryouRes.ok) {
          const data = await foryouRes.json();
          console.log(`[Browse] ForYou received: ${data.length} movies.`);
          setForyou(shuffleArray(data));
        }

        // Because You Liked: Anchor-based recs
        const relatedRes = await fetch(`http://localhost:5000/api/browse/related?t=${timestamp}`, { headers });
        if (relatedRes.ok) {
          const data = await relatedRes.json();
          console.log('[Browse] Related response:', data);
          if (data.movies && data.movies.length > 0) {
            setAnchorTitle(data.anchor || 'Your Recent Activity');
            setRelated(shuffleArray(data.movies));
          } else {
            console.log('[Browse] Related empty - hiding row');
            setRelated([]);
          }
        } else {
          console.error('[Browse] Related API fetch failed');
        }
        // AI Personalized: New Gemini-driven row
        fetchAiRecs();

      } catch (error) {
        console.error('[Browse] Fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, fetchAiRecs]);

  // Auto-scroll Hero Carousel with restart logic on manual change
  useEffect(() => {
    const startTimer = () => {
      if (trending.length > 0) {
        if (spotlightTimerRef.current) clearInterval(spotlightTimerRef.current);
        spotlightTimerRef.current = setInterval(() => {
          setCurrentSlide((prev) => (prev + 1) % Math.min(5, trending.length));
        }, 8000);
      }
    };
    startTimer();
    return () => {
      if (spotlightTimerRef.current) clearInterval(spotlightTimerRef.current);
    };
  }, [trending]);

  // Auto-scroll AI Carousel
  useEffect(() => {
    if (aiRecs.length === 0) return;
    if (aiCarouselTimerRef.current) clearInterval(aiCarouselTimerRef.current);
    aiCarouselTimerRef.current = setInterval(() => {
      setAiSlide((prev) => (prev + 1) % aiRecs.length);
    }, 6000);
    return () => {
      if (aiCarouselTimerRef.current) clearInterval(aiCarouselTimerRef.current);
    };
  }, [aiRecs]);

  const handleAiSlideClick = (idx) => {
    setAiSlide(idx);
    if (aiCarouselTimerRef.current) clearInterval(aiCarouselTimerRef.current);
    aiCarouselTimerRef.current = setInterval(() => {
      setAiSlide((prev) => (prev + 1) % aiRecs.length);
    }, 6000);
  };

  const handleIndicatorClick = (idx) => {
    setCurrentSlide(idx);
    // Restart interval on manual click
    if (spotlightTimerRef.current) clearInterval(spotlightTimerRef.current);
    spotlightTimerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % Math.min(5, trending.length));
    }, 8000);
  };

  if (isLoading && trending.length === 0) {
    return (
      <div className="browse-loading">
        <div className="loader"></div>
        <p>Curating your personal cinema experience...</p>
      </div>
    );
  }

  const spotlightMovie = trending.length > 0 ? trending[currentSlide] : null;

  return (
    <div className="browse-page-container">
      {/* 1. Enhanced Spotlight Hero Section (Random 5) */}
      {spotlightMovie && (
        <section className="spotlight-section">
          {trending.slice(0, 5).map((movie, idx) => (
            <div
              key={movie.id}
              className={`spotlight-slide ${idx === currentSlide ? 'active' : ''}`}
            >
              <div
                className="spotlight-backdrop"
                style={{
                  backgroundImage: `linear-gradient(to top, rgba(15,15,15,1) 0%, rgba(15,15,15,0.4) 50%, rgba(15,15,15,0.8) 100%), url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`
                }}
              ></div>

              <div className="spotlight-content">
                <div className="badge-featured">EXCLUSIVE FEATURE</div>
                <h1 className="spotlight-title">{movie.title}</h1>

                <div className="spotlight-metadata">
                  <span className="rating-pill">⭐ {Number(movie.vote_average)?.toFixed(1)}</span>
                  <span className="year-pill">{movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</span>
                  <span className="trending-pill">🔥 Trending #{(idx + 1)}</span>
                </div>

                <p className="spotlight-description">
                  {movie.overview?.length > 280 ? movie.overview.substring(0, 277) + '...' : movie.overview}
                </p>

                <div className="spotlight-actions">
                  <button
                    className="btn-play"
                    onClick={() => navigate(`/movie/${movie.id}`)}
                  >
                    <span>▶</span> Detailed Information
                  </button>
                  <button className="btn-watchlist-add">+ Add to Collection</button>
                </div>
              </div>
            </div>
          ))}

          <div className="spotlight-indicators">
            {trending.slice(0, 5).map((m, idx) => (
              <button
                key={m.id}
                className={`indicator-dot ${idx === currentSlide ? 'active' : ''}`}
                onClick={() => handleIndicatorClick(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              ></button>
            ))}
          </div>
        </section>
      )}

      <div className="browse-main-content">

        {/* Row 0: AI Personalized — Cinematic Carousel */}
        {aiRecs.length > 0 && (
          <div className="ai-carousel-section">

            {/* Header */}
            <div className="ai-carousel-header">
              <div className="header-left">
                <h2 className="row-title ai-title">✨ AI Picks For You</h2>
                <span className="ai-badge">BETA</span>
              </div>

              <div className="header-right">
                <button
                  className={`btn-ai-refresh ${isAiLoading ? 'loading' : ''}`}
                  onClick={() => { fetchAiRecs(true); setAiSlide(0); }}
                  disabled={isAiLoading}
                >
                  {isAiLoading ? 'Generating...' : '💡 Refresh AI'}
                </button>
              </div>
            </div>

            {/* Carousel */}
            <div className="ai-carousel-stage">
              {aiRecs.map((movie, idx) => (
                <div
                  key={movie.id}
                  className={`ai-carousel-slide ${idx === aiSlide ? 'active' : ''}`}
                >
                  <div
                    className="ai-slide-backdrop"
                    style={{
                      backgroundImage: `linear-gradient(to right, rgba(15,15,15,1) 0%, rgba(15,15,15,0.2) 60%, rgba(15,15,15,0.8) 100%), url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`
                    }}
                  ></div>

                  <div className="ai-slide-content">
                    <div className="ai-movie-poster">
                      <img
                        src={movie.poster_path
                          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                          : 'https://via.placeholder.com/500x750?text=PopCorn'}
                        alt={movie.title}
                        onClick={() => navigate(`/movie/${movie.id}`)}
                      />
                    </div>

                    <div className="ai-slide-info">
                      <h3 className="ai-slide-title" onClick={() => navigate(`/movie/${movie.id}`)}>
                        {movie.title}
                      </h3>

                      <div className="ai-slide-metadata">
                        <span className="rating-pill">⭐ {Number(movie.vote_average)?.toFixed(1)}</span>
                        <span className="year-pill">{movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</span>
                      </div>

                      <div className="ai-note-container">
                        <span className="quote-icon">"</span>
                        <p className="ai-note-text">
                          {movie.ai_note}
                        </p>
                      </div>

                      <div className="ai-slide-actions">
                        <button
                          className="btn-play-sm"
                          onClick={() => navigate(`/movie/${movie.id}`)}
                        >
                          ▶ Play
                        </button>
                        <button className="btn-watchlist-add-sm">+ Collection</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Indicators */}
            <div className="ai-carousel-dots">
              {aiRecs.map((_, idx) => (
                <button
                  key={idx}
                  className={`ai-dot ${idx === aiSlide ? 'active' : ''}`}
                  onClick={() => handleAiSlideClick(idx)}
                />
              ))}
            </div>

          </div>
        )}

        {/* Row 1: Curated For You */}
        {foryou.length > 0 && (
          <div className="recommendation-row">
            <div className="row-header">
              <h2 className="row-title">Curated For You</h2>
              <div className="row-line"></div>
            </div>
            <div className="horizontal-slider">
              {foryou.map((movie) => (
                <div key={movie.id} className="movie-poster-card" onClick={() => navigate(`/movie/${movie.id}`)}>
                  <div className="poster-inner">
                    <img
                      src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=PopCorn'}
                      alt={movie.title}
                      loading="lazy"
                    />
                    <div className="poster-overlay">
                      <div className="overlay-info">
                        <span className="overlay-rating">⭐ {Number(movie.vote_average)?.toFixed(1)}</span>
                        <div className="overlay-play">▶</div>
                      </div>
                    </div>
                  </div>
                  <h3 className="card-movie-title">{movie.title}</h3>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Row 2: Because You Liked (Anchor-based) */}
        {related.length > 0 && (
          <div className="recommendation-row">
            <div className="row-header">
              <h2 className="row-title">Because you liked {anchorTitle}</h2>
              <div className="row-line"></div>
            </div>
            <div className="horizontal-slider">
              {related.map((movie) => (
                <div key={movie.id} className="movie-poster-card" onClick={() => navigate(`/movie/${movie.id}`)}>
                  <div className="poster-inner">
                    <img
                      src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=PopCorn'}
                      alt={movie.title}
                      loading="lazy"
                    />
                    <div className="poster-overlay">
                      <div className="overlay-info">
                        <span className="overlay-rating">⭐ {Number(movie.vote_average)?.toFixed(1)}</span>
                        <div className="overlay-play">▶</div>
                      </div>
                    </div>
                  </div>
                  <h3 className="card-movie-title">{movie.title}</h3>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Row 2: Similar Minds Picked */}
        {collaborative.length > 0 && (
          <div className="recommendation-row">
            <div className="row-header">
              <h2 className="row-title">Similar Minds Picked</h2>
              <div className="row-line"></div>
            </div>
            <div className="horizontal-slider">
              {collaborative.map((movie) => (
                <div key={movie.id} className="movie-poster-card" onClick={() => navigate(`/movie/${movie.id}`)}>
                  <div className="poster-inner">
                    <img
                      src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=PopCorn'}
                      alt={movie.title}
                      loading="lazy"
                    />
                    <div className="poster-overlay">
                      <div className="overlay-info">
                        <span className="overlay-rating">⭐ {Number(movie.vote_average)?.toFixed(1)}</span>
                        <div className="overlay-play">▶</div>
                      </div>
                    </div>
                  </div>
                  <h3 className="card-movie-title">{movie.title}</h3>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Hits / Trending */}
        {trending.length > 0 && (
          <div className="recommendation-row">
            <div className="row-header">
              <h2 className="row-title">Global Top 20</h2>
              <div className="row-line"></div>
            </div>
            <div className="horizontal-slider">
              {trending.map((movie) => (
                <div key={movie.id} className="movie-poster-card" onClick={() => navigate(`/movie/${movie.id}`)}>
                  <div className="poster-inner">
                    <img
                      src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=PopCorn'}
                      alt={movie.title}
                      loading="lazy"
                    />
                    <div className="poster-overlay">
                      <div className="overlay-info">
                        <span className="overlay-rating">⭐ {Number(movie.vote_average)?.toFixed(1)}</span>
                        <div className="overlay-play">▶</div>
                      </div>
                    </div>
                  </div>
                  <h3 className="card-movie-title">{movie.title}</h3>
                </div>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div className="upsell-container">
            <div className="upsell-card">
              <h2>Experience the magic of choice!</h2>
              <p>Register now to unlock our advanced Collaborative Filtering and Preference-based discovery tools.</p>
              <button className="btn-register-upsell">Join the Experience</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowsePage;

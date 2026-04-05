import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

const TMDB_API_KEY = 'ffb76769eee5be098b949fd3877a9d0b';

const TrailerRow = () => {
  const [trailers, setTrailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function fetchTrailers() {
      try {
        const { data } = await supabase
          .from('movies')
          .select('id, title')
          .not('id', 'is', null)
          .order('popularity', { ascending: false })
          .limit(60); // fetch enough to ensure we definitely get 10 with trailers

        if (data && data.length > 0) {
          const shuffled = data.sort(() => 0.5 - Math.random());

          const trailerPromises = shuffled.map(async (m) => {
            try {
              const res = await fetch(`https://api.themoviedb.org/3/movie/${m.id}/videos?api_key=${TMDB_API_KEY}`);
              const vidData = await res.json();
              if (vidData.results && vidData.results.length > 0) {
                const official = vidData.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') || vidData.results.find(v => v.site === 'YouTube');
                if (official) return { movie: m, key: official.key };
              }
            } catch (e) {
              // ignore fetch errors for single movies
            }
            return null;
          });
          const fetched = (await Promise.all(trailerPromises)).filter(Boolean);
          setTrailers(fetched.slice(0, 10));
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    fetchTrailers();
  }, []);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % trailers.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + trailers.length) % trailers.length);
  };

  if (loading || trailers.length === 0) return null;

  return (
    <div style={{ padding: '60px 20px 40px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
        <h3 style={{ borderLeft: '5px solid #f5c518', paddingLeft: '20px', margin: 0, fontSize: '2.5rem', fontFamily: 'Outfit, sans-serif', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px' }}>
          Trending Trailers
        </h3>
      </div>

      <div style={{ position: 'relative', width: '100%', borderRadius: '24px', overflow: 'hidden', backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>

        {/* Sliding Track */}
        <div style={{
          display: 'flex',
          width: '100%',
          transition: 'transform 0.7s cubic-bezier(0.25, 1, 0.5, 1)',
          transform: `translateX(-${currentIndex * 100}%)`
        }}
        >
          {trailers.map((t, idx) => (
            <div key={t.key + idx} style={{ flex: '0 0 100%', width: '100%' }}>
              <div style={{ padding: '20px 30px', background: 'linear-gradient(90deg, #111, #1a1a1a)', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, color: '#f5c518', fontSize: '24px', fontFamily: 'Outfit, sans-serif' }}>
                  {t.movie.title}
                </h4>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px', fontWeight: 'bold', letterSpacing: '2px' }}>
                  {idx + 1} / {trailers.length}
                </div>
              </div>

              <div style={{ position: 'relative', width: '100%', paddingBottom: '45%', height: 0, background: '#000' }}>
                <iframe
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: currentIndex === idx ? 'auto' : 'none' }}
                  src={`https://www.youtube.com/embed/${t.key}?rel=0&showinfo=0`}
                  title={`${t.movie.title} Trailer`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                ></iframe>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Overlays */}
        <button
          onClick={handlePrev}
          style={{ position: 'absolute', top: '50%', left: '30px', transform: 'translateY(-50%)', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(10,10,10,0.7)', border: '2px solid rgba(245, 197, 24, 0.4)', color: 'white', fontSize: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease', zIndex: 10, backdropFilter: 'blur(8px)' }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#f5c518'; e.currentTarget.style.color = 'black'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(10,10,10,0.7)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
        >
          ‹
        </button>

        <button
          onClick={handleNext}
          style={{ position: 'absolute', top: '50%', right: '30px', transform: 'translateY(-50%)', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(10,10,10,0.7)', border: '2px solid rgba(245, 197, 24, 0.4)', color: 'white', fontSize: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease', zIndex: 10, backdropFilter: 'blur(8px)' }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#f5c518'; e.currentTarget.style.color = 'black'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(10,10,10,0.7)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
        >
          ›
        </button>

      </div>
    </div>
  );
};

export default TrailerRow;

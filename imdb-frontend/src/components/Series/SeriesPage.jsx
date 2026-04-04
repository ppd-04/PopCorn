import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Link } from 'react-router-dom';
import './SeriesPage.css';

function SeriesPage() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState('popularity');
  const ITEMS_PER_PAGE = 20;
  const debounceRef = useRef(null);
  const pageRef = useRef(0);

  const fetchSeries = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const pageNum = reset ? 0 : pageRef.current;
      const from = pageNum * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('serieses')
        .select('*');

      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      if (sortBy === 'popularity') {
        query = query.order('popularity', { ascending: false });
      } else if (sortBy === 'rating') {
        query = query.order('vote_average', { ascending: false });
      } else if (sortBy === 'newest') {
        query = query.order('first_air_date', { ascending: false });
      } else if (sortBy === 'oldest') {
        query = query.order('first_air_date', { ascending: true });
      } else if (sortBy === 'name') {
        query = query.order('name', { ascending: true });
      }
      
      // Tie breaker for consistent pagination
      query = query.order('tmdb_id', { ascending: true });

      query = query.range(from, to);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching series:', error);
      } else {
        if (reset) {
          setSeries(data || []);
          pageRef.current = 1;
        } else {
          setSeries(prev => {
            const existingIds = new Set(prev.map(s => s.tmdb_id));
            const newItems = (data || []).filter(s => !existingIds.has(s.tmdb_id));
            // Just exactly copy prev but add non-duplicate new items
            return [...prev, ...newItems];
          });
          pageRef.current = pageNum + 1;
        }
        setHasMore((data || []).length === ITEMS_PER_PAGE);
      }
    } catch (err) {
      console.error('Series fetch error:', err);
    }
    setLoading(false);
  }, [searchTerm, sortBy]);

  // Initial load + search/sort change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSeries(true);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, sortBy, fetchSeries]);

  const loadMore = () => {
    fetchSeries(false);
  };

  return (
    <div className="series-page">
      <div className="series-header">
        <h1 className="series-title">📺 Series Collection</h1>
        <p className="series-subtitle">Explore top-rated TV shows and series from around the world</p>
      </div>

      <div className="series-controls">
        <div className="series-search">
          <input
            type="text"
            placeholder="Search series..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="series-sort">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="popularity">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">A-Z</option>
          </select>
        </div>
      </div>

      {loading && series.length === 0 ? (
        <div className="series-loading">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="series-card-skeleton" />
          ))}
        </div>
      ) : series.length === 0 ? (
        <div className="series-empty">
          <span style={{ fontSize: '3rem' }}>📭</span>
          <h3>No series found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="series-grid">
            {series.map(show => {
              const posterUrl = show.poster_path
                ? (show.poster_path.startsWith('http')
                  ? show.poster_path
                  : `https://image.tmdb.org/t/p/w300${show.poster_path}`)
                : null;
              const year = show.first_air_date ? show.first_air_date.split('-')[0] : '';

              return (
                <Link to={`/series/${show.tmdb_id}`} key={show.tmdb_id} className="series-card-link" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="series-card">
                    <div className="series-poster">
                      {posterUrl ? (
                        <img src={posterUrl} alt={show.name} />
                      ) : (
                        <div className="series-no-poster">📺</div>
                      )}
                      {show.vote_average > 0 && (
                        <div className="series-rating-badge">
                          ⭐ {Number(show.vote_average).toFixed(1)}
                        </div>
                      )}
                      {show.status && (
                        <div className={`series-status-badge ${show.status === 'Returning Series' ? 'returning' : show.status === 'Ended' ? 'ended' : ''}`}>
                          {show.status}
                        </div>
                      )}
                    </div>
                    <div className="series-info">
                      <h3 className="series-name">{show.name}</h3>
                      <div className="series-meta">
                        {year && <span className="series-year">{year}</span>}
                        {show.number_of_seasons && (
                          <span className="series-seasons">{show.number_of_seasons} Season{show.number_of_seasons > 1 ? 's' : ''}</span>
                        )}
                        {show.number_of_episodes && (
                          <span className="series-episodes">{show.number_of_episodes} Ep</span>
                        )}
                      </div>
                      {show.overview && (
                        <p className="series-overview">
                          {show.overview.length > 120 ? show.overview.slice(0, 117) + '...' : show.overview}
                        </p>
                      )}
                      {show.genres && typeof show.genres === 'string' && (
                        <div className="series-genres">
                          {show.genres.split(',').slice(0, 3).map((g, i) => (
                            <span key={i} className="series-genre-tag">{g.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {hasMore && !loading && (
            <div className="series-load-more">
              <button onClick={loadMore} className="btn btn-primary">
                Load More Series
              </button>
            </div>
          )}

          {loading && series.length > 0 && (
            <div className="series-load-more">
              <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading more...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SeriesPage;

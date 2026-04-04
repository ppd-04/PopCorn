import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import './SeriesDetails.css';

const API_BASE = 'http://localhost:5000/api';

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

const SeriesDetails = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);

  // User interaction state
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [isWatched, setIsWatched] = useState(false);

  // Rating state
  const [myRating, setMyRating] = useState(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);

  // Comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Related series
  const [relatedSeries, setRelatedSeries] = useState([]);

  // Fetch series data from Supabase
  useEffect(() => {
    async function fetchSeriesData() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('serieses')
          .select('*')
          .eq('tmdb_id', id)
          .single();

        if (error) {
          console.error('Error fetching series:', error);
        } else {
          setSeries(data);

          // Set initial rating from Supabase data
          if (data.vote_average) setAvgRating(Number(data.vote_average));
          if (data.vote_count) setTotalRatings(data.vote_count);
        }

        // Fetch seasons
        const { data: seasonData, error: seasonError } = await supabase
          .from('seasons')
          .select('*')
          .eq('series_id', Number(id));

        if (!seasonError && seasonData) {
          setSeasons(seasonData);
        }
      } catch (err) {
        console.error('Series fetch error:', err);
      }
      setLoading(false);
    }
    fetchSeriesData();
  }, [id]);

  // Fetch series rating from backend
  const fetchRating = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/series/${id}/rating`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.avg_rating) setAvgRating(data.avg_rating);
        if (data.total_ratings) setTotalRatings(data.total_ratings);
        if (data.my_rating) setMyRating(data.my_rating);
      }
    } catch (err) { /* API may not exist yet, will use Supabase data */ }
  }, [id]);

  // Fetch user status from backend
  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/series/${id}/status`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInWatchlist(data.in_watchlist || false);
        setIsFavourite(data.is_favourite || false);
        setIsWatched(data.is_watched || false);
      }
    } catch (err) { /* API may not exist yet */ }
  }, [id, user]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/series/${id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) { /* API may not exist yet */ }
  }, [id]);

  // Fetch related series
  const fetchRelated = useCallback(async () => {
    if (!series) return;
    try {
      // Get series with similar genres
      const genreStr = series.genres;
      if (!genreStr) return;

      const firstGenre = typeof genreStr === 'string' ? genreStr.split(',')[0].trim() : '';
      if (!firstGenre) return;

      const { data, error } = await supabase
        .from('serieses')
        .select('tmdb_id, name, poster_path, vote_average, first_air_date')
        .ilike('genres', `%${firstGenre}%`)
        .neq('tmdb_id', Number(id))
        .order('popularity', { ascending: false })
        .limit(10);

      if (!error && data) {
        setRelatedSeries(data);
      }
    } catch (err) { console.error('Related fetch error:', err); }
  }, [id, series]);

  useEffect(() => {
    if (id) {
      fetchRating();
      fetchStatus();
      fetchComments();
    }
  }, [id, fetchRating, fetchStatus, fetchComments]);

  useEffect(() => {
    if (series) {
      fetchRelated();
    }
  }, [series, fetchRelated]);

  // ---- HANDLERS ----

  const handleRate = async (rating) => {
    if (!user) return alert('Please log in to rate series');
    try {
      const res = await fetch(`${API_BASE}/series/${id}/rate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rating })
      });
      if (res.ok) {
        const data = await res.json();
        setMyRating(data.my_rating || rating);
        if (data.avg_rating) setAvgRating(data.avg_rating);
        if (data.total_ratings) setTotalRatings(data.total_ratings);
      }
    } catch (err) { console.error('Rate failed:', err); }
  };

  const handleToggle = async (type, setter) => {
    if (!user) return alert('Please log in');
    try {
      const res = await fetch(`${API_BASE}/series/${id}/${type}`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (type === 'watchlist') setter(data.in_watchlist);
        if (type === 'favourite') setter(data.is_favourite);
        if (type === 'watched') setter(data.is_watched);
      }
    } catch (err) { console.error(`Toggle ${type} failed:`, err); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) return alert('Please log in to post comments');
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`${API_BASE}/series/${id}/comments`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: newComment.trim() })
      });
      if (res.ok) {
        const comment = await res.json();
        setComments([comment, ...comments]);
        setNewComment('');
      }
    } catch (err) { alert('Failed to post comment'); }
    finally { setSubmittingComment(false); }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const res = await fetch(`${API_BASE}/series-comments/${commentId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        setComments(comments.filter(c => c.comment_id !== commentId));
      }
    } catch (err) { alert('Failed to delete comment'); }
  };

  // ---- RENDER ----

  if (loading) {
    return (
      <div className="sd-page">
        <div className="sd-loading">
          <div className="spinner"></div>
          <p>Loading series details...</p>
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="sd-page">
        <div className="sd-not-found">Series not found</div>
      </div>
    );
  }

  const bgImageUrl = series.backdrop_path
    ? (series.backdrop_path.startsWith('http')
      ? series.backdrop_path
      : `https://image.tmdb.org/t/p/original${series.backdrop_path}`)
    : series.poster_path
      ? (series.poster_path.startsWith('http')
        ? series.poster_path
        : `https://image.tmdb.org/t/p/original${series.poster_path}`)
      : '';

  const backgroundStyle = {
    backgroundImage: bgImageUrl
      ? `linear-gradient(to bottom, rgba(15, 15, 20, 0.6), rgba(15, 15, 20, 0.95)), url(${bgImageUrl})`
      : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    backgroundRepeat: 'no-repeat',
    minHeight: '100vh',
  };

  const posterUrl = series.poster_path
    ? (series.poster_path.startsWith('http')
      ? series.poster_path
      : `https://image.tmdb.org/t/p/w500${series.poster_path}`)
    : null;

  const year = series.first_air_date ? series.first_air_date.split('-')[0] : '';

  return (
    <div className="sd-page" style={backgroundStyle}>
      <div className="sd-container">

        {/* Back Button */}
        <button onClick={() => navigate(-1)} className="sd-back-btn">
          ← Back
        </button>

        {/* ========== HERO SECTION ========== */}
        <div className="sd-hero">
          <div className="sd-poster-wrap">
            {posterUrl ? (
              <img src={posterUrl} alt={series.name} className="sd-poster" />
            ) : (
              <div className="sd-poster-placeholder">📺 No Image</div>
            )}
          </div>

          <div className="sd-info">
            <h1 className="sd-title">{series.name}</h1>
            {series.original_name && series.original_name !== series.name && (
              <p className="sd-tagline">"{series.original_name}"</p>
            )}

            {/* Status & Meta */}
            <div className="sd-meta-row">
              {series.status && (
                <span className={`sd-status-pill ${series.status === 'Returning Series' ? 'returning' : series.status === 'Ended' ? 'ended' : ''}`}>
                  {series.status}
                </span>
              )}
              {year && <span className="sd-meta-pill">{year}</span>}
              {series.original_language && <span className="sd-meta-pill">{series.original_language.toUpperCase()}</span>}
              {series.type && <span className="sd-meta-pill">{series.type}</span>}
            </div>

            {/* Action Buttons */}
            <div className="sd-actions">
              <button
                className={`sd-action-btn ${inWatchlist ? 'active' : ''}`}
                onClick={() => handleToggle('watchlist', setInWatchlist)}
              >
                <span className="btn-icon">{inWatchlist ? '📋' : '➕'}</span>
                {inWatchlist ? 'In Watchlist' : 'Watchlist'}
              </button>
              <button
                className={`sd-action-btn ${isFavourite ? 'active' : ''}`}
                onClick={() => handleToggle('favourite', setIsFavourite)}
              >
                <span className="btn-icon">{isFavourite ? '❤️' : '🤍'}</span>
                {isFavourite ? 'Favourited' : 'Favourite'}
              </button>
              <button
                className={`sd-action-btn ${isWatched ? 'active' : ''}`}
                onClick={() => handleToggle('watched', setIsWatched)}
              >
                <span className="btn-icon">{isWatched ? '✅' : '👁️'}</span>
                {isWatched ? 'Watched' : 'Mark Watched'}
              </button>
            </div>

            {/* Rating Section */}
            <div className="sd-rating-section">
              <div className="sd-rating-header">
                <div className="sd-avg-rating">
                  <span className="sd-avg-number">
                    {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                  </span>
                  <div className="sd-avg-meta">
                    <span className="sd-avg-label">Rating</span>
                    <span className="sd-avg-count">
                      {totalRatings > 0 ? `${totalRatings} vote${totalRatings !== 1 ? 's' : ''}` : 'No ratings yet'}
                    </span>
                  </div>
                </div>

                <div className="sd-star-rating">
                  <div className="sd-stars">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                      <span
                        key={star}
                        className={`sd-star ${(hoverRating || myRating || 0) >= star ? 'filled' : 'empty'}`}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => handleRate(star)}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="sd-your-rating">
                    {myRating ? `Your rating: ${myRating}/10` : (user ? 'Rate this series' : 'Log in to rate')}
                  </span>
                </div>
              </div>
            </div>

            {/* Overview */}
            <div className="sd-overview">
              <h3>Overview</h3>
              <p>{series.overview || "No overview available."}</p>
            </div>

            {/* Details Grid */}
            <div className="sd-details-grid">
              <div className="sd-detail-item">
                <div className="sd-detail-label">📅 First Aired</div>
                <div className="sd-detail-value">{series.first_air_date || 'Unknown'}</div>
              </div>
              {series.number_of_seasons && (
                <div className="sd-detail-item">
                  <div className="sd-detail-label">📺 Seasons</div>
                  <div className="sd-detail-value">{series.number_of_seasons}</div>
                </div>
              )}
              {series.number_of_episodes && (
                <div className="sd-detail-item">
                  <div className="sd-detail-label">🎬 Episodes</div>
                  <div className="sd-detail-value">{series.number_of_episodes}</div>
                </div>
              )}
              {series.popularity && (
                <div className="sd-detail-item">
                  <div className="sd-detail-label">🔥 Popularity</div>
                  <div className="sd-detail-value">{Math.round(series.popularity)}</div>
                </div>
              )}
              {series.created_by && (
                <div className="sd-detail-item">
                  <div className="sd-detail-label">🎭 Created By</div>
                  <div className="sd-detail-value">{series.created_by}</div>
                </div>
              )}
              {series.genres && (
                <div className="sd-detail-item">
                  <div className="sd-detail-label">🎪 Genres</div>
                  <div className="sd-detail-value">{series.genres}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== SEASONS SECTION ========== */}
        {seasons.length > 0 && (
          <div className="sd-seasons-section">
            <h2 className="sd-section-title">📺 Seasons ({seasons.length})</h2>
            <div className="sd-seasons-grid">
              {seasons.map(season => {
                return (
                  <div key={season.seasonid} className="sd-season-card">
                    <div className="sd-season-poster">
                      <div className="sd-season-no-poster">📺</div>
                    </div>
                    <div className="sd-season-info">
                      <h4>{season.name || `Season`}</h4>
                      <div className="sd-season-meta">
                        {season.year_aired && <span>{season.year_aired}</span>}
                        {season.ratings && <span>⭐ {Number(season.ratings).toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========== COMMENTS SECTION ========== */}
        <div className="sd-comments-section">
          <h2 className="sd-section-title">💬 Discussion ({comments.length})</h2>

          <form className="sd-add-comment" onSubmit={handleAddComment}>
            <div className="sd-comment-avatar">
              {user && user.profile_picture ? (
                <img src={user.profile_picture} alt="You" />
              ) : '👤'}
            </div>
            <div className="sd-comment-input-wrap">
              <textarea
                className="sd-comment-input"
                placeholder={user ? "Share your thoughts about this series..." : "Log in to share your thoughts..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={submittingComment}
              />
              <button
                className="sd-comment-submit-btn"
                type="submit"
                disabled={submittingComment || !newComment.trim()}
              >
                {submittingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>

          {comments.length === 0 ? (
            <div className="sd-no-comments">No comments yet. Be the first to share your thoughts!</div>
          ) : (
            comments.map(comment => (
              <div key={comment.comment_id} className="sd-comment-item">
                <div className="sd-comment-avatar">
                  {comment.profile_picture ? (
                    <img src={comment.profile_picture} alt={comment.username} />
                  ) : '👤'}
                </div>
                <div className="sd-comment-bubble">
                  <div className="sd-comment-author">{comment.full_name || comment.username}</div>
                  <div className="sd-comment-text">{comment.content}</div>
                  <div className="sd-comment-footer">
                    <span className="sd-comment-time">{timeAgo(comment.created_at)}</span>
                    {user && user.id === comment.user_id && (
                      <button
                        className="sd-comment-delete"
                        onClick={() => handleDeleteComment(comment.comment_id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ========== RELATED SERIES ========== */}
        {relatedSeries.length > 0 && (
          <div className="sd-related-section">
            <h2 className="sd-section-title">📺 Similar Series</h2>
            <div className="sd-related-grid">
              {relatedSeries.map(rs => {
                const rsPoster = rs.poster_path
                  ? (rs.poster_path.startsWith('http')
                    ? rs.poster_path
                    : `https://image.tmdb.org/t/p/w200${rs.poster_path}`)
                  : null;

                return (
                  <a href={`/series/${rs.tmdb_id}`} key={rs.tmdb_id} className="sd-related-card">
                    {rsPoster ? (
                      <img src={rsPoster} alt={rs.name} className="sd-related-poster" />
                    ) : (
                      <div className="sd-related-poster-placeholder">📺</div>
                    )}
                    <div className="sd-related-info">
                      <div className="sd-related-title">{rs.name}</div>
                      <div className="sd-related-meta">
                        <span>{rs.first_air_date ? rs.first_air_date.split('-')[0] : '—'}</span>
                        <span className="sd-related-rating">⭐ {rs.vote_average ? Number(rs.vote_average).toFixed(1) : 'N/A'}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SeriesDetails;

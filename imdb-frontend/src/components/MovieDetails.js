import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import MovieTrailer from './MovieTrailer';
import './MovieDetails.css';

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

const MovieDetails = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rating state
  const [avgRating, setAvgRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [myRating, setMyRating] = useState(null);
  const [hoverRating, setHoverRating] = useState(0);

  // User status state
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);

  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Related movies
  const [relatedMovies, setRelatedMovies] = useState([]);

  useEffect(() => {
    async function fetchMovie() {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error("Error fetching movie:", error);
      } else {
        setMovie(data);
      }
      setLoading(false);
    }
    fetchMovie();
  }, [id]);


  const fetchRating = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/movies/${id}/rating`, { headers: authHeaders() });
      const data = await res.json();
      if (data.avg_rating !== undefined) setAvgRating(Number(data.avg_rating));
      if (data.total_ratings !== undefined) setTotalRatings(Number(data.total_ratings));
      if (data.my_rating !== undefined) setMyRating(Number(data.my_rating));
    } catch (err) { console.error('Failed to fetch rating:', err); }
  }, [id]);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/movies/${id}/status`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInWatchlist(data.in_watchlist);
        setIsFavourite(data.is_favourite);
        setIsWatched(data.is_watched);
      }
      // Fetch wishlist status separately
      const wlRes = await fetch(`${API_BASE}/movies/${id}/wishlist-status`, { headers: authHeaders() });
      if (wlRes.ok) {
        const wlData = await wlRes.json();
        setInWishlist(wlData.in_wishlist);
      }
    } catch (err) { console.error('Failed to fetch status:', err); }
  }, [id, user]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/movies/${id}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (err) { console.error('Failed to fetch comments:', err); }
  }, [id]);

  // Fetch related movies
  const fetchRelated = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/movies/${id}/related`);
      const data = await res.json();
      setRelatedMovies(data);
    } catch (err) { console.error('Failed to fetch related:', err); }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchRating();
      fetchStatus();
      fetchComments();
      fetchRelated();
    }
  }, [id, fetchRating, fetchStatus, fetchComments, fetchRelated]);

  // ---- HANDLERS ----

  const handleRate = async (rating) => {
    if (!user) return alert('Please log in to rate movies');
    try {
      const res = await fetch(`${API_BASE}/movies/${id}/rate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rating })
      });
      if (res.ok) {
        const data = await res.json();
        setMyRating(data.my_rating);
        if (data.avg_rating !== undefined) setAvgRating(Number(data.avg_rating));
        if (data.total_ratings !== undefined) setTotalRatings(Number(data.total_ratings));
      }
    } catch (err) { console.error('Rate failed:', err); }
  };

  const handleToggle = async (type, setter) => {
    if (!user) return alert('Please log in');
    try {
      const res = await fetch(`${API_BASE}/movies/${id}/${type}`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (type === 'watchlist') setter(data.in_watchlist);
        if (type === 'favourite') setter(data.is_favourite);
        if (type === 'watched') setter(data.is_watched);
        if (type === 'wishlist') setter(data.in_wishlist);
      }
    } catch (err) { console.error(`Toggle ${type} failed:`, err); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user) return alert('Please log in to post comments');
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`${API_BASE}/movies/${id}/comments`, {
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
      const res = await fetch(`${API_BASE}/movie-comments/${commentId}`, {
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
      <div className="md-page">
        <div className="md-loading">
          <div className="spinner"></div>
          <p>Loading movie details...</p>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="md-page">
        <div className="md-not-found">Movie not found</div>
      </div>
    );
  }

  const bgImageUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : movie.poster_path
      ? `https://image.tmdb.org/t/p/original${movie.poster_path}`
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

  return (
    <div className="md-page" style={backgroundStyle}>
      <div className="md-container">

        {/* Back Button */}
        <button onClick={() => navigate(-1)} className="md-back-btn">
          ← Back
        </button>

        {/* ========== HERO SECTION ========== */}
        <div className="md-hero">
          <div className="md-poster-wrap">
            {movie.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                alt={movie.title}
                className="md-poster"
              />
            ) : (
              <div className="md-poster-placeholder">No Image</div>
            )}
          </div>

          <div className="md-info">
            <h1 className="md-title">{movie.title}</h1>
            {movie.tagline && <p className="md-tagline">"{movie.tagline}"</p>}

            {/* Action Buttons — visible for everyone, prompts login on click */}
            <div className="md-actions">
              <button
                className={`md-action-btn ${inWatchlist ? 'active' : ''}`}
                onClick={() => handleToggle('watchlist', setInWatchlist)}
              >
                <span className="btn-icon">{inWatchlist ? '📋' : '➕'}</span>
                {inWatchlist ? 'In Watchlist' : 'Watchlist'}
              </button>
              <button
                className={`md-action-btn ${isFavourite ? 'active' : ''}`}
                onClick={() => handleToggle('favourite', setIsFavourite)}
              >
                <span className="btn-icon">{isFavourite ? '❤️' : '🤍'}</span>
                {isFavourite ? 'Favourited' : 'Favourite'}
              </button>
              <button
                className={`md-action-btn ${isWatched ? 'active' : ''}`}
                onClick={() => handleToggle('watched', setIsWatched)}
              >
                <span className="btn-icon">{isWatched ? '✅' : '👁️'}</span>
                {isWatched ? 'Watched' : 'Mark Watched'}
              </button>
              <button
                className={`md-action-btn ${inWishlist ? 'active' : ''}`}
                onClick={() => handleToggle('wishlist', setInWishlist)}
              >
                <span className="btn-icon">{inWishlist ? '🎯' : '💫'}</span>
                {inWishlist ? 'In Wishlist' : 'Wishlist'}
              </button>
            </div>

            {/* Rating Section */}
            <div className="md-rating-section">
              <div className="md-rating-header">
                <div className="md-avg-rating">
                  <span className="md-avg-number">
                    {Number(avgRating || 0) > 0 ? Number(avgRating).toFixed(1) : (movie.vote_average ? Number(movie.vote_average).toFixed(1) : '—')}
                  </span>
                  <div className="md-avg-meta">
                    <span className="md-avg-label">PopCorn Rating</span>
                    <span className="md-avg-count">
                      {totalRatings > 0 ? `${Number(totalRatings).toLocaleString()} votes` : (movie.vote_count ? `${Number(movie.vote_count).toLocaleString()} votes` : 'No ratings yet')}
                    </span>
                  </div>
                </div>

                <div className="md-star-rating">
                  <div className="md-stars">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                      <span
                        key={star}
                        className={`md-star ${(hoverRating || myRating || 0) >= star ? 'filled' : 'empty'}`}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => handleRate(star)}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="md-your-rating">
                    {myRating ? `Your rating: ${myRating}/10` : (user ? 'Rate this movie' : 'Log in to rate')}
                  </span>
                </div>
              </div>
            </div>

            {/* Overview */}
            <div className="md-overview">
              <h3>Overview</h3>
              <p>{movie.overview || "No overview available."}</p>
            </div>

            {/* ekhane add kortesi */}
            <MovieTrailer movieId={movie.tmdb_id} />

            {/* Details Grid */}
            <div className="md-details-grid">
              <div className="md-detail-item">
                <div className="md-detail-label">📅 Release Date</div>
                <div className="md-detail-value">{movie.release_date || 'Unknown'}</div>
              </div>
              <div className="md-detail-item">
                <div className="md-detail-label">⏳ Runtime</div>
                <div className="md-detail-value">{movie.runtime ? `${movie.runtime} min` : 'Unknown'}</div>
              </div>
              <div className="md-detail-item">
                <div className="md-detail-label">💰 Budget</div>
                <div className="md-detail-value">{movie.budget ? `$${movie.budget.toLocaleString()}` : 'N/A'}</div>
              </div>
              <div className="md-detail-item">
                <div className="md-detail-label">💵 Revenue</div>
                <div className="md-detail-value">{movie.revenue ? `$${movie.revenue.toLocaleString()}` : 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== COMMENTS SECTION ========== */}
        <div className="md-comments-section">
          <h2 className="md-section-title">💬 Discussion ({comments.length})</h2>

          {/* Comment form — visible for everyone */}
          <form className="md-add-comment" onSubmit={handleAddComment}>
            <div className="md-comment-avatar">
              {user && user.profile_picture ? (
                <img src={user.profile_picture} alt="You" />
              ) : '👤'}
            </div>
            <div className="md-comment-input-wrap">
              <textarea
                className="md-comment-input"
                placeholder={user ? "Share your thoughts about this movie..." : "Log in to share your thoughts..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={submittingComment}
              />
              <button
                className="md-comment-submit-btn"
                type="submit"
                disabled={submittingComment || !newComment.trim()}
              >
                {submittingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>

          {comments.length === 0 ? (
            <div className="md-no-comments">No comments yet. Be the first to share your thoughts!</div>
          ) : (
            comments.map(comment => (
              <div key={comment.comment_id} className="md-comment-item">
                <div className="md-comment-avatar">
                  {comment.profile_picture ? (
                    <img src={comment.profile_picture} alt={comment.username} />
                  ) : '👤'}
                </div>
                <div className="md-comment-bubble">
                  <div className="md-comment-author">{comment.full_name || comment.username}</div>
                  <div className="md-comment-text">{comment.content}</div>
                  <div className="md-comment-footer">
                    <span className="md-comment-time">{timeAgo(comment.created_at)}</span>
                    {user && user.id === comment.user_id && (
                      <button
                        className="md-comment-delete"
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

        {/* ========== RELATED MOVIES ========== */}
        {relatedMovies.length > 0 && (
          <div className="md-related-section">
            <h2 className="md-section-title">🎬 Related Movies</h2>
            <div className="md-related-grid">
              {relatedMovies.map(rm => (
                <Link to={`/movie/${rm.id}`} key={rm.id} className="md-related-card">
                  {rm.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${rm.poster_path}`}
                      alt={rm.title}
                      className="md-related-poster"
                    />
                  ) : (
                    <div className="md-related-poster-placeholder">No Image</div>
                  )}
                  <div className="md-related-info">
                    <div className="md-related-title">{rm.title}</div>
                    <div className="md-related-meta">
                      <span>{rm.release_date ? rm.release_date.split('-')[0] : '—'}</span>
                      <span className="md-related-rating">⭐ {rm.vote_average ? Number(rm.vote_average).toFixed(1) : 'N/A'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MovieDetails;
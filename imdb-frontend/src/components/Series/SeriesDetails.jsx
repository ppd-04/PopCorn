import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { renderWithMentions } from '../../utils/MentionsUtil';
import MentionInput from '../Social/MentionInput';
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
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

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

  // Threading states
  const [replyToId, setReplyToId] = useState(null);
  const [replyContent, setReplyContent] = useState('');

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
          if (data.vote_average) setAvgRating(Number(data.vote_average));
          if (data.vote_count) setTotalRatings(data.vote_count);
        }

        // Fetch seasons from the 'season' table — series_id corresponds to tmdb_id
        const { data: seasonData, error: seasonError } = await supabase
          .from('season')
          .select('*')
          .eq('series_id', Number(id))
          .order('season_number', { ascending: true });

        if (!seasonError && seasonData && seasonData.length > 0) {
          setSeasons(seasonData);
          setSelectedSeason(seasonData[0]);
        }
      } catch (err) {
        console.error('Series fetch error:', err);
      }
      setLoading(false);
    }
    fetchSeriesData();
  }, [id]);

  // Fetch series rating from backend (blended IMDB + user)
  const fetchRating = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/series/${id}/rating`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.avg_rating !== undefined) setAvgRating(Number(data.avg_rating));
        if (data.total_ratings !== undefined) setTotalRatings(Number(data.total_ratings));
        if (data.my_rating !== undefined && data.my_rating !== null) setMyRating(Number(data.my_rating));
      }
    } catch (err) { /* fallback to supabase data */ }
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

  const fetchEpisodes = useCallback(async (seasonNum) => {
    setLoadingEpisodes(true);
    try {
      const res = await fetch(`${API_BASE}/series/${id}/season/${seasonNum}/episodes`);
      if (res.ok) {
        const data = await res.json();
        setEpisodes(data);
      }
    } catch (err) { console.error('Episodes fetch error:', err); }
    setLoadingEpisodes(false);
  }, [id]);

  // Fetch related series
  const fetchRelated = useCallback(async () => {
    if (!series) return;
    try {
      const genreStr = series.genres;
      if (!genreStr) return;
      const firstGenre = Array.isArray(genreStr)
        ? genreStr[0]
        : typeof genreStr === 'string' ? genreStr.split(',')[0].trim() : '';
      if (!firstGenre) return;

      const { data, error } = await supabase
        .from('serieses')
        .select('tmdb_id, name, poster_path, vote_average, first_air_date')
        .ilike('genres', `%${firstGenre}%`)
        .neq('tmdb_id', Number(id))
        .order('popularity', { ascending: false })
        .limit(10);

      if (!error && data) setRelatedSeries(data);
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
    if (selectedSeason) {
      fetchEpisodes(selectedSeason.season_number);
    }
  }, [selectedSeason, fetchEpisodes]);

  useEffect(() => {
    if (series) fetchRelated();
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
        if (data.avg_rating !== undefined) setAvgRating(Number(data.avg_rating));
        if (data.total_ratings !== undefined) setTotalRatings(Number(data.total_ratings));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to rate');
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
      } else {
        const err = await res.json();
        alert(err.error || `Failed to toggle ${type}`);
      }
    } catch (err) { console.error(`Toggle ${type} failed:`, err); }
  };

  const handleAddComment = async (parentId = null) => {
    const text = parentId ? replyContent : newComment;
    if (!user) return alert('Please log in to post comments');
    if (!text.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`${API_BASE}/series/${id}/comments`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: text.trim(), parent_id: parentId })
      });
      if (res.ok) {
        const comment = await res.json();
        setComments([...comments, comment]);
        if (parentId) {
          setReplyToId(null);
          setReplyContent('');
        } else {
          setNewComment('');
        }
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

  const genreList = Array.isArray(series.genres)
    ? series.genres
    : typeof series.genres === 'string'
      ? series.genres.split(',').map(g => g.trim())
      : [];

  const selectedSeasonPoster = selectedSeason?.poster_path
    ? `https://image.tmdb.org/t/p/w342${selectedSeason.poster_path}`
    : null;

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

            {/* Genre Tags */}
            {genreList.length > 0 && (
              <div className="sd-genre-tags">
                {genreList.map((g, i) => (
                  <span key={i} className="sd-genre-tag">{g}</span>
                ))}
              </div>
            )}

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
                className={`sd-action-btn ${isFavourite ? 'active fav' : ''}`}
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
                    {Number(avgRating || 0) > 0 ? Number(avgRating).toFixed(1) : '—'}
                  </span>
                  <div className="sd-avg-meta">
                    <span className="sd-avg-label">PopCorn Rating</span>
                    <span className="sd-avg-count">
                      {totalRatings > 0 ? `${Number(totalRatings).toLocaleString()} votes` : 'No ratings yet'}
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
                  <div className="sd-detail-value">
                    {Array.isArray(series.created_by) ? series.created_by.join(', ') : series.created_by}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== SEASONS SECTION ========== */}
        {seasons.length > 0 && (
          <div className="sd-seasons-section">
            <h2 className="sd-section-title">📺 Seasons ({seasons.length})</h2>

            {/* Season Selector Tabs */}
            <div className="sd-season-tabs">
              {seasons.map(season => (
                <button
                  key={season.tmdb_id || season.season_number}
                  className={`sd-season-tab ${selectedSeason?.season_number === season.season_number ? 'active' : ''}`}
                  onClick={() => setSelectedSeason(season)}
                >
                  {season.season_number === 0 ? 'Specials' : `S${season.season_number}`}
                </button>
              ))}
            </div>

            {/* Selected Season Detail */}
            {selectedSeason && (
              <div className="sd-season-detail">
                <div className="sd-season-detail-poster">
                  {selectedSeasonPoster ? (
                    <img src={selectedSeasonPoster} alt={selectedSeason.name} />
                  ) : (
                    <div className="sd-season-poster-placeholder">
                      <span>📺</span>
                      <span>No Poster</span>
                    </div>
                  )}
                </div>
                <div className="sd-season-detail-info">
                  <h3 className="sd-season-detail-title">
                    {selectedSeason.name || `Season ${selectedSeason.season_number}`}
                  </h3>
                  <div className="sd-season-detail-meta">
                    {selectedSeason.season_number !== undefined && (
                      <span className="sd-season-meta-badge">
                        📺 Season {selectedSeason.season_number}
                      </span>
                    )}
                    {selectedSeason.episode_count && (
                      <span className="sd-season-meta-badge">
                        🎬 {selectedSeason.episode_count} Episodes
                      </span>
                    )}
                    {selectedSeason.air_date && (
                      <span className="sd-season-meta-badge">
                        📅 {new Date(selectedSeason.air_date).getFullYear()}
                      </span>
                    )}
                  </div>
                  {selectedSeason.overview && (
                    <p className="sd-season-detail-overview">
                      {selectedSeason.overview}
                    </p>
                  )}
                  {!selectedSeason.overview && (
                    <p className="sd-season-detail-overview sd-no-overview">
                      No overview available for this season.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Episode List */}
            {selectedSeason && (
              <div className="sd-episodes-section">
                <h3 className="sd-episodes-title">🎬 Episodes</h3>
                {loadingEpisodes ? (
                  <div className="sd-episodes-loading">
                    <div className="mini-spinner"></div>
                    <span>Fetching episodes...</span>
                  </div>
                ) : episodes.length > 0 ? (
                  <div className="sd-episodes-list">
                    {episodes.map(ep => (
                      <div key={ep.episode_id || ep.episode_number} className="sd-episode-item">
                        <div className="sd-episode-still">
                          {ep.still_path ? (
                            <img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt={ep.name} />
                          ) : (
                            <div className="sd-episode-no-still">🎬</div>
                          )}
                          <div className="sd-episode-number">E{ep.episode_number}</div>
                        </div>
                        <div className="sd-episode-info">
                          <div className="sd-episode-header">
                            <h4 className="sd-episode-name">{ep.name}</h4>
                            <span className="sd-episode-rating">⭐ {ep.vote_average ? Number(ep.vote_average).toFixed(1) : 'N/A'}</span>
                          </div>
                          <div className="sd-episode-airdate">{ep.air_date || 'Unknown Date'}</div>
                          <p className="sd-episode-overview">{ep.overview || 'No overview available for this episode.'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="sd-no-episodes">No episodes found for this season.</div>
                )}
              </div>
            )}

            {/* All Seasons Grid (mini cards) */}
            <div className="sd-seasons-grid">
              {seasons.map(season => {
                const sPoster = season.poster_path
                  ? `https://image.tmdb.org/t/p/w185${season.poster_path}`
                  : null;
                const isSelected = selectedSeason?.season_number === season.season_number;
                return (
                  <div
                    key={season.tmdb_id || season.season_number}
                    className={`sd-season-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedSeason(season)}
                  >
                    <div className="sd-season-card-poster">
                      {sPoster ? (
                        <img src={sPoster} alt={season.name} />
                      ) : (
                        <div className="sd-season-no-poster">📺</div>
                      )}
                      {isSelected && <div className="sd-season-selected-badge">✓</div>}
                    </div>
                    <div className="sd-season-card-info">
                      <div className="sd-season-card-name">
                        {season.name || `Season ${season.season_number}`}
                      </div>
                      {season.episode_count && (
                        <div className="sd-season-card-eps">{season.episode_count} eps</div>
                      )}
                      {season.air_date && (
                        <div className="sd-season-card-year">
                          {new Date(season.air_date).getFullYear()}
                        </div>
                      )}
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

          {!replyToId && (
            <div className="sd-add-comment">
              <div className="sd-comment-avatar">
                {user && user.profile_picture ? (
                  <img src={user.profile_picture} alt="You" />
                ) : '👤'}
              </div>
              <div className="sd-comment-input-wrap">
                <MentionInput
                  className="sd-comment-input"
                  placeholder={user ? "Share your thoughts about this series..." : "Log in to share your thoughts..."}
                  value={newComment}
                  onChange={(v) => setNewComment(v)}
                  disabled={submittingComment}
                />
                <button
                  className="sd-comment-submit-btn"
                  onClick={() => handleAddComment(null)}
                  disabled={submittingComment || !newComment.trim()}
                >
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          )}

          {comments.length === 0 ? (
            <div className="sd-no-comments">No comments yet. Be the first to share your thoughts!</div>
          ) : (
            <div className="sd-comments-list">
              {comments.filter(c => !c.parent_id).map(comment => (
                <SDCommentItem 
                  key={comment.comment_id}
                  comment={comment}
                  allComments={comments}
                  user={user}
                  onDelete={handleDeleteComment}
                  onReply={setReplyToId}
                  replyToId={replyToId}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  submitReply={handleAddComment}
                  level={1}
                  navigate={navigate}
                />
              ))}
            </div>
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

const SDCommentItem = ({ 
  comment, allComments, user, onDelete, onReply, replyToId, 
  replyContent, setReplyContent, submitReply, level, navigate
}) => {
  const replies = allComments.filter(r => r.parent_id === comment.comment_id);
  const isOwner = user && (user.id === comment.user_id || user.user_id === comment.user_id);

  return (
    <div className={`sd-comment-thread-container sd-level-${level} ${level > 1 ? 'sd-nested' : ''}`}>
      <div className="sd-comment-item">
        <div className="sd-comment-avatar">
          {comment.profile_picture ? <img src={comment.profile_picture} alt={comment.username} /> : '👤'}
        </div>
        <div className="sd-comment-bubble">
          <div className="sd-comment-author">{comment.full_name || comment.username}</div>
          <div className="sd-comment-text">{renderWithMentions(comment.content, navigate)}</div>
          <div className="sd-comment-footer">
            <span className="sd-comment-time">{timeAgo(comment.created_at)}</span>
            {level < 3 && user && (
              <button className="sd-comment-action-btn" onClick={() => onReply(comment.comment_id)}>Reply</button>
            )}
            {isOwner && (
              <button className="sd-comment-action-btn sd-delete" onClick={() => onDelete(comment.comment_id)}>Delete</button>
            )}
          </div>
        </div>
      </div>

      {replyToId === comment.comment_id && (
        <div className="sd-reply-form-inline">
          <MentionInput
            className="sd-comment-input small" 
            placeholder={`Reply to ${comment.username}...`}
            value={replyContent} 
            onChange={v => setReplyContent(v)}
            autoFocus
          />
          <div className="sd-reply-actions">
            <button className="sd-reply-submit" onClick={() => submitReply(comment.comment_id)}>Post Reply</button>
            <button className="sd-reply-cancel" onClick={() => onReply(null)}>Cancel</button>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div className="sd-replies-list">
          {replies.map(r => (
            <SDCommentItem 
              key={r.comment_id}
              comment={r}
              allComments={allComments}
              user={user}
              onDelete={onDelete}
              onReply={onReply}
              replyToId={replyToId}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              submitReply={submitReply}
              level={level + 1}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SeriesDetails;

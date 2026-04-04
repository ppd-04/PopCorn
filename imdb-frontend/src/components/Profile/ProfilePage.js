import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import './ProfilePage.css';

const API_BASE = 'http://localhost:5000/api';


function authHeaders() {
  const token = localStorage.getItem('token');
  return token
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}


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
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString();
}


const activityConfig = {
  rated: { icon: '⭐', label: 'Rated' },
  watchlist_add: { icon: '📋', label: 'Added to watchlist' },
  watchlist_remove: { icon: '📋', label: 'Removed from watchlist' },
  favourite_add: { icon: '❤️', label: 'Added to favourites' },
  favourite_remove: { icon: '💔', label: 'Removed from favourites' },
  watched: { icon: '✅', label: 'Watched' },
  wishlist_add: { icon: '🎯', label: 'Added to wishlist' },
  wishlist_remove: { icon: '🎯', label: 'Removed from wishlist' },
};


const CHART_COLORS = ['#f5c518', '#e6b800', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeead', '#d4a5a5', '#9b59b6', '#3498db'];

const TABS = [
  { id: 'overview', label: 'Overview', icon: '👤' },
  { id: 'watchlist', label: 'Watchlist', icon: '📋' },
  { id: 'wishlist', label: 'Wishlist', icon: '🎯' },
  { id: 'favourites', label: 'Favourites', icon: '❤️' },
  { id: 'ratings', label: 'Ratings', icon: '⭐' },
  { id: 'people', label: 'Favourite People', icon: '🌟' },
  { id: 'interests', label: 'Interests', icon: '🎭' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const ProfilePage = ({ user, setUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  // Profile data
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // List data
  const [watchlist, setWatchlist] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [favouritePeople, setFavouritePeople] = useState([]);

  // Stats
  const [stats, setStats] = useState(null);

  // Interests
  const [allGenres, setAllGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [savingInterests, setSavingInterests] = useState(false);

  // Settings
  const [settingsForm, setSettingsForm] = useState({ full_name: '', phone_number: '', address: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [settingsMessage, setSettingsMessage] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const fileInputRef = useRef(null);

  const setActiveTab = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/profile`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setSettingsForm({
          full_name: data.full_name || '',
          phone_number: data.phone_number || '',
          address: data.address || ''
        });
      }
    } catch (err) { console.error('Failed to fetch profile:', err); }
    finally { setLoading(false); }
  }, []);

  // Fetch lists
  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/profile/watchlist`, { headers: authHeaders() });
      if (res.ok) setWatchlist(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchWishlist = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/profile/wishlist`, { headers: authHeaders() });
      if (res.ok) setWishlist(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchFavourites = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/profile/favourites`, { headers: authHeaders() });
      if (res.ok) setFavourites(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchRatings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/profile/ratings`, { headers: authHeaders() });
      if (res.ok) setRatings(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchFavouritePeople = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/profile/favourite-people`, { headers: authHeaders() });
      if (res.ok) setFavouritePeople(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/profile/stats`, { headers: authHeaders() });
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  const fetchGenres = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/genres`);
      if (res.ok) setAllGenres(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  // Initial load
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Fetch data when tab changes
  useEffect(() => {
    switch (activeTab) {
      case 'overview': fetchStats(); break;
      case 'watchlist': fetchWatchlist(); break;
      case 'wishlist': fetchWishlist(); break;
      case 'favourites': fetchFavourites(); break;
      case 'ratings': fetchRatings(); break;
      case 'people': fetchFavouritePeople(); break;
      case 'interests':
        fetchGenres();
        fetchStats(); // to get current interests
        break;
      case 'stats': fetchStats(); break;
      default: break;
    }
  }, [activeTab, fetchStats, fetchWatchlist, fetchWishlist, fetchFavourites, fetchRatings, fetchFavouritePeople, fetchGenres]);

  // Set selected genres when stats load
  useEffect(() => {
    if (stats && stats.interests) {
      setSelectedGenres(stats.interests.map(i => i.genre_id));
    }
  }, [stats]);

  // Handlers
  const handleRemoveFromList = async (movieId, type) => {
    try {
      const res = await fetch(`${API_BASE}/movies/${movieId}/${type}`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        if (type === 'watchlist') fetchWatchlist();
        if (type === 'favourite') fetchFavourites();
        if (type === 'wishlist') fetchWishlist();
      }
    } catch (err) { console.error(err); }
  };

  const handleUnfollowPerson = async (personId) => {
    try {
      const res = await fetch(`${API_BASE}/people/${personId}/follow`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) fetchFavouritePeople();
    } catch (err) { console.error(err); }
  };

  const handleFollowPerson = async (person) => {
    try {
      const res = await fetch(`${API_BASE}/people/${person.person_id}/follow`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          person_name: person.person_name,
          person_role: person.person_role,
          profile_path: person.profile_path
        })
      });
      if (res.ok) fetchFavouritePeople();
    } catch (err) { console.error(err); }
  };

  const handleToggleGenre = (genreId) => {
    setSelectedGenres(prev =>
      prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  };

  const handleSaveInterests = async () => {
    setSavingInterests(true);
    try {
      const res = await fetch(`${API_BASE}/profile/interests`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ genre_ids: selectedGenres })
      });
      if (res.ok) {
        fetchStats();
      }
    } catch (err) { console.error(err); }
    finally { setSavingInterests(false); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setSettingsMessage(null);
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(settingsForm)
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.user);
        // Update localStorage user data
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const updated = { ...stored, ...data.user };
        localStorage.setItem('user', JSON.stringify(updated));
        if (setUser) setUser(updated);
        setSettingsMessage({ type: 'success', text: 'Profile updated successfully! ✨' });
      } else {
        setSettingsMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (err) {
      setSettingsMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/profile/password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully! 🔒' });
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      } else {
        setPasswordMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch (err) {
      setPasswordMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
    finally { setChangingPassword(false); }
  };

  const handleProfilePicUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      setSettingsMessage({ type: 'error', text: 'Image must be under 2MB' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch(`${API_BASE}/profile`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ profile_picture: reader.result })
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data.user);
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          const updated = { ...stored, profile_picture: reader.result };
          localStorage.setItem('user', JSON.stringify(updated));
          if (setUser) setUser(updated);
          setSettingsMessage({ type: 'success', text: 'Profile picture updated! 📷' });
        }
      } catch (err) {
        setSettingsMessage({ type: 'error', text: 'Failed to upload picture' });
      }
    };
    reader.readAsDataURL(file);
  };

  // ====================================
  // RENDER HELPERS
  // ====================================

  const renderMovieGrid = (movies, listType) => {
    if (movies.length === 0) {
      const emptyMessages = {
        watchlist: { icon: '📋', title: 'Your watchlist is empty', desc: 'Add movies to your watchlist from the movie details page.' },
        wishlist: { icon: '🎯', title: 'Your wishlist is empty', desc: 'Add movies you want to see to your wishlist.' },
        favourites: { icon: '❤️', title: 'No favourites yet', desc: 'Mark your favourite movies from their details page.' },
      };
      const msg = emptyMessages[listType] || { icon: '🎬', title: 'Nothing here yet', desc: '' };
      return (
        <div className="empty-state">
          <div className="empty-state-icon">{msg.icon}</div>
          <h3>{msg.title}</h3>
          <p>{msg.desc}</p>
        </div>
      );
    }
    return (
      <div className="profile-movie-grid">
        {movies.map(movie => (
          <div key={movie.movie_id} className="profile-movie-card">
            <Link to={`/movie/${movie.movie_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="profile-movie-poster">
                {movie.poster_path ? (
                  <img src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`} alt={movie.title} />
                ) : (
                  <div className="no-poster">🎬</div>
                )}
              </div>
              <div className="profile-movie-info">
                <h4>{movie.title || 'Unknown Movie'}</h4>
                <div className="profile-movie-meta">
                  <span>{movie.release_date ? movie.release_date.split('-')[0] : '—'}</span>
                  <span className="profile-movie-rating">⭐ {movie.vote_average ? Number(movie.vote_average).toFixed(1) : 'N/A'}</span>
                </div>
              </div>
            </Link>
            <div className="profile-movie-actions">
              <button
                className="remove-btn"
                onClick={() => handleRemoveFromList(movie.movie_id, listType === 'favourites' ? 'favourite' : listType)}
              >
                🗑️ Remove
              </button>
              <Link to={`/movie/${movie.movie_id}`} style={{ textDecoration: 'none', flex: 1 }}>
                <button style={{ width: '100%', padding: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                  🔗 Details
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ====================================
  // RENDER TABS
  // ====================================

  const renderOverview = () => {
    return (
      <div className="profile-tab-content">
        <h2 className="tab-section-title">📊 Quick Stats</h2>
        {stats ? (
          <div className="stats-overview-cards">
            <div className="stat-card">
              <div className="stat-card-icon">🎬</div>
              <span className="stat-card-number">{stats.movies_watched}</span>
              <span className="stat-card-label">Movies Watched</span>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">⭐</div>
              <span className="stat-card-number">{stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : '—'}</span>
              <span className="stat-card-label">Avg Rating</span>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">📋</div>
              <span className="stat-card-number">{stats.watchlist_count}</span>
              <span className="stat-card-label">In Watchlist</span>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">❤️</div>
              <span className="stat-card-number">{stats.favourites_count}</span>
              <span className="stat-card-label">Favourites</span>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">🏆</div>
              <span className="stat-card-number">{stats.total_ratings}</span>
              <span className="stat-card-label">Ratings Given</span>
            </div>
          </div>
        ) : (
          <div className="profile-loading"><div className="profile-spinner"></div><p>Loading stats...</p></div>
        )}

        {/* Recent Activity */}
        {stats && stats.recent_activity && stats.recent_activity.length > 0 && (
          <>
            <h2 className="tab-section-title" style={{ marginTop: '30px' }}>🕐 Recent Activity</h2>
            <div className="activity-feed">
              {stats.recent_activity.slice(0, 8).map((act, idx) => {
                const cfg = activityConfig[act.activity_type] || { icon: '📌', label: act.activity_type };
                return (
                  <div key={idx} className="activity-item">
                    <div className={`activity-icon ${act.activity_type}`}>{cfg.icon}</div>
                    <div className="activity-text">
                      {act.details || cfg.label}
                      {act.movie_title && <> — <span className="movie-name">{act.movie_title}</span></>}
                    </div>
                    <span className="activity-time">{timeAgo(act.created_at)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderRatings = () => {
    if (ratings.length === 0) {
      return (
        <div className="profile-tab-content">
          <div className="empty-state">
            <div className="empty-state-icon">⭐</div>
            <h3>No ratings yet</h3>
            <p>Rate movies from their details page to see them here.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="profile-tab-content">
        <h2 className="tab-section-title">⭐ Your Ratings ({ratings.length})</h2>
        <div className="ratings-list">
          {ratings.map(r => (
            <Link to={`/movie/${r.movie_id}`} key={r.movie_id} className="rating-item">
              <div className="rating-item-poster">
                {r.poster_path ? (
                  <img src={`https://image.tmdb.org/t/p/w100${r.poster_path}`} alt={r.title} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#2a2a2aff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🎬</div>
                )}
              </div>
              <div className="rating-item-info">
                <h4>{r.title || 'Unknown Movie'}</h4>
                <span className="rating-date">{r.release_date ? r.release_date.split('-')[0] : '—'} • Rated {timeAgo(r.rated_at)}</span>
              </div>
              <div className="rating-item-stars">
                <span className="rating-value">{Number(r.rating).toFixed(1)}</span>
                <span className="rating-max">/10</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  const renderFavouritePeople = () => {
    // Hardcoded suggestions for demo
    const suggestedPeople = [
      { person_id: 287, person_name: 'Brad Pitt', person_role: 'Actor', profile_path: '/kU3B75TyCpC0p21m4iBIs9cZpI.jpg' },
      { person_id: 113640, person_name: 'Tom Holland', person_role: 'Actor', profile_path: '/bBRlrpJm9XkArtcVcgGmyyvE5W.jpg' },
      { person_id: 11288, person_name: 'Robert Pattinson', person_role: 'Actor', profile_path: '/1cmc6SgcE9A6FldS997q5RIfc7.jpg' },
      { person_id: 138, person_name: 'Quentin Tarantino', person_role: 'Director', profile_path: '/qE1iXyVwY3i36PZ0iB2XqVnBEvC.jpg' }
    ];

    const isFollowing = (id) => favouritePeople.some(p => p.person_id === id);

    return (
      <div className="profile-tab-content">
        <h2 className="tab-section-title">🌟 Favourite People ({favouritePeople.length})</h2>
        
        {favouritePeople.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🌟</div>
            <h3>No favourite people yet</h3>
            <p>Follow your favourite actors, directors, and crew members.</p>
          </div>
        ) : (
          <div className="people-grid">
            {favouritePeople.map(person => (
              <div key={person.person_id} className="person-card">
                <div className="person-avatar">
                  {person.profile_path ? (
                    <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt={person.person_name} />
                  ) : '👤'}
                </div>
                <h4>{person.person_name}</h4>
                <div className="person-role">{person.person_role || 'Artist'}</div>
                <button className="unfollow-btn" onClick={() => handleUnfollowPerson(person.person_id)}>
                  Unfollow
                </button>
              </div>
            ))}
          </div>
        )}

        <h2 className="tab-section-title" style={{ marginTop: '40px' }}>🔍 Suggestions to Follow</h2>
        <div className="people-grid">
          {suggestedPeople.filter(p => !isFollowing(p.person_id)).map(person => (
            <div key={person.person_id} className="person-card" style={{ opacity: 0.8 }}>
              <div className="person-avatar">
                {person.profile_path ? (
                  <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt={person.person_name} />
                ) : '👤'}
              </div>
              <h4>{person.person_name}</h4>
              <div className="person-role">{person.person_role}</div>
              <button 
                className="unfollow-btn" 
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(245, 197, 24, 0.1)' }}
                onClick={() => handleFollowPerson(person)}
              >
                + Follow
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderInterests = () => {
    return (
      <div className="profile-tab-content">
        <h2 className="tab-section-title">🎭 Your Interests</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Select the genres you love. This helps us personalize your experience.
        </p>
        <div className="interests-container">
          {allGenres.map(genre => (
            <button
              key={genre.id}
              className={`genre-chip ${selectedGenres.includes(genre.id) ? 'selected' : ''}`}
              onClick={() => handleToggleGenre(genre.id)}
            >
              {selectedGenres.includes(genre.id) ? '✓ ' : ''}{genre.name}
            </button>
          ))}
        </div>
        {allGenres.length > 0 && (
          <button
            className="save-interests-btn"
            onClick={handleSaveInterests}
            disabled={savingInterests}
          >
            {savingInterests ? 'Saving...' : '💾 Save Interests'}
          </button>
        )}
        {allGenres.length === 0 && (
          <div className="profile-loading"><div className="profile-spinner"></div><p>Loading genres...</p></div>
        )}
      </div>
    );
  };

  const renderStats = () => {
    if (!stats) {
      return <div className="profile-loading"><div className="profile-spinner"></div><p>Loading stats...</p></div>;
    }

    return (
      <div className="profile-tab-content">
        <h2 className="tab-section-title">📊 Stats Dashboard</h2>

        {/* Overview Cards */}
        <div className="stats-overview-cards">
          <div className="stat-card">
            <div className="stat-card-icon">🎬</div>
            <span className="stat-card-number">{stats.movies_watched}</span>
            <span className="stat-card-label">Watched</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">⭐</div>
            <span className="stat-card-number">{stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : '—'}</span>
            <span className="stat-card-label">Avg Rating</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">🏆</div>
            <span className="stat-card-number">{stats.total_ratings}</span>
            <span className="stat-card-label">Ratings</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">📋</div>
            <span className="stat-card-number">{stats.watchlist_count}</span>
            <span className="stat-card-label">Watchlist</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">❤️</div>
            <span className="stat-card-number">{stats.favourites_count}</span>
            <span className="stat-card-label">Favourites</span>
          </div>
        </div>

        {/* Charts */}
        <div className="charts-grid">
          {stats.genre_distribution && stats.genre_distribution.length > 0 && (
            <div className="chart-card">
              <h3>🍩 Genre Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.genre_distribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.genre_distribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {stats.rating_distribution && stats.rating_distribution.length > 0 && (
            <div className="chart-card">
              <h3>📊 Your Rating Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.rating_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="rating_value" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(245,197,24,0.2)', borderRadius: '10px' }}
                    labelStyle={{ color: '#f5c518' }}
                  />
                  <Bar dataKey="count" fill="#f5c518" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {stats.monthly_activity && stats.monthly_activity.length > 0 && (
            <div className="chart-card">
              <h3>📈 Monthly Activity</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={stats.monthly_activity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(245,197,24,0.2)', borderRadius: '10px' }}
                    labelStyle={{ color: '#f5c518' }}
                  />
                  <Line type="monotone" dataKey="activity_count" stroke="#f5c518" strokeWidth={3} dot={{ fill: '#f5c518', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {stats.recent_activity && stats.recent_activity.length > 0 && (
          <>
            <h2 className="tab-section-title" style={{ marginTop: '10px' }}>🕐 Activity Feed</h2>
            <div className="activity-feed">
              {stats.recent_activity.map((act, idx) => {
                const cfg = activityConfig[act.activity_type] || { icon: '📌', label: act.activity_type };
                return (
                  <div key={idx} className="activity-item">
                    <div className={`activity-icon ${act.activity_type}`}>{cfg.icon}</div>
                    <div className="activity-text">
                      {act.details || cfg.label}
                      {act.movie_title && <> — <span className="movie-name">{act.movie_title}</span></>}
                    </div>
                    <span className="activity-time">{timeAgo(act.created_at)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {(!stats.genre_distribution || stats.genre_distribution.length === 0) &&
         (!stats.rating_distribution || stats.rating_distribution.length === 0) &&
         (!stats.monthly_activity || stats.monthly_activity.length === 0) && (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>No data yet</h3>
            <p>Start watching and rating movies to see your stats!</p>
          </div>
        )}
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="profile-tab-content">
        <h2 className="tab-section-title">⚙️ Account Settings</h2>
        <div className="settings-container">
          {/* Profile Picture */}
          <div className="settings-section">
            <h3>📷 Profile Picture</h3>
            <div className="settings-profile-pic-section">
              <div className="settings-avatar-preview">
                {profile?.profile_picture ? (
                  <img src={profile.profile_picture} alt="Profile" />
                ) : (
                  profile?.username?.charAt(0).toUpperCase() || '?'
                )}
              </div>
              <div className="settings-pic-actions">
                <button className="settings-pic-btn" onClick={() => fileInputRef.current?.click()}>
                  📷 Upload New Picture
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Max 2MB, JPG/PNG</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePicUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>👤 Profile Information</h3>
            <form onSubmit={handleUpdateProfile}>
              <div className="settings-form-group">
                <label>Full Name</label>
                <input
                  className="settings-input"
                  type="text"
                  value={settingsForm.full_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, full_name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>
              <div className="settings-form-group">
                <label>Email</label>
                <input
                  className="settings-input"
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  style={{ opacity: 0.6 }}
                />
              </div>
              <div className="settings-form-group">
                <label>Phone Number</label>
                <input
                  className="settings-input"
                  type="tel"
                  value={settingsForm.phone_number}
                  onChange={(e) => setSettingsForm({ ...settingsForm, phone_number: e.target.value })}
                  placeholder="+880 1XXX-XXXXXX"
                />
              </div>
              <div className="settings-form-group">
                <label>Address</label>
                <input
                  className="settings-input"
                  type="text"
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                  placeholder="Your address"
                />
              </div>
              <button
                className="settings-btn primary"
                type="submit"
                disabled={savingProfile}
              >
                {savingProfile ? 'Saving...' : '💾 Save Changes'}
              </button>
              {settingsMessage && (
                <div className={`settings-message ${settingsMessage.type}`}>{settingsMessage.text}</div>
              )}
            </form>
          </div>

          <div className="settings-section">
            <h3>🔒 Change Password</h3>
            <form onSubmit={handleChangePassword}>
              <div className="settings-form-group">
                <label>Current Password</label>
                <input
                  className="settings-input"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="settings-form-group">
                <label>New Password</label>
                <input
                  className="settings-input"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <div className="settings-form-group">
                <label>Confirm New Password</label>
                <input
                  className="settings-input"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                className="settings-btn primary"
                type="submit"
                disabled={changingPassword}
              >
                {changingPassword ? 'Changing...' : '🔑 Change Password'}
              </button>
              {passwordMessage && (
                <div className={`settings-message ${passwordMessage.type}`}>{passwordMessage.text}</div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-loading">
            <div className="profile-spinner"></div>
            <p>Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar-large">
            {(profile?.profile_picture || user?.profile_picture) ? (
              <img 
                src={profile?.profile_picture || user?.profile_picture} 
                alt={profile?.full_name || profile?.username || user?.username} 
              />
            ) : (
              (profile?.username || user?.username || '?').charAt(0).toUpperCase()
            )}
          </div>
          <div className="profile-header-info">
            <h1>{profile?.full_name || profile?.username || user?.username || 'PopCorn User'}</h1>
            <div className="profile-email">
              @{profile?.username || user?.username} • {profile?.email || user?.email}
            </div>
            <div className="profile-join-date">
              {/* CHANGE: Added user fallback for created_at date */}
              🎬 Member since {(profile?.created_at || user?.created_at) 
                ? new Date(profile?.created_at || user?.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) 
                : 'Unknown'}
            </div>
            {stats && (
              <div className="profile-quick-stats">
                <div className="quick-stat-card">
                  <span className="quick-stat-number">{stats.movies_watched}</span>
                  <span className="quick-stat-label">Watched</span>
                </div>
                <div className="quick-stat-card">
                  <span className="quick-stat-number">{stats.total_ratings}</span>
                  <span className="quick-stat-label">Rated</span>
                </div>
                <div className="quick-stat-card">
                  <span className="quick-stat-number">{stats.favourites_count}</span>
                  <span className="quick-stat-label">Favourites</span>
                </div>
              </div>
            )}
          </div>
        </div>





        {/* <div className="profile-header">
          <div className="profile-avatar-large">
            {profile?.profile_picture ? (
              <img src={profile.profile_picture} alt={profile.full_name || profile.username} />
            ) : (
              profile?.username?.charAt(0).toUpperCase() || '?'
            )}
          </div>
          <div className="profile-header-info">
            <h1>{profile?.full_name || profile?.username || 'PopCorn User'}</h1>
            <div className="profile-email">@{profile?.username} • {profile?.email}</div>
            <div className="profile-join-date">
              🎬 Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Unknown'}
            </div>
            {stats && (
              <div className="profile-quick-stats">
                <div className="quick-stat-card">
                  <span className="quick-stat-number">{stats.movies_watched}</span>
                  <span className="quick-stat-label">Watched</span>
                </div>
                <div className="quick-stat-card">
                  <span className="quick-stat-number">{stats.total_ratings}</span>
                  <span className="quick-stat-label">Rated</span>
                </div>
                <div className="quick-stat-card">
                  <span className="quick-stat-number">{stats.favourites_count}</span>
                  <span className="quick-stat-label">Favourites</span>
                </div>
              </div>
            )}
          </div>
        </div> */}

        {/* Tabs Navigation */}
        <div className="profile-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'watchlist' && (
          <div className="profile-tab-content">
            <h2 className="tab-section-title">📋 Watchlist ({watchlist.length})</h2>
            {renderMovieGrid(watchlist, 'watchlist')}
          </div>
        )}
        {activeTab === 'wishlist' && (
          <div className="profile-tab-content">
            <h2 className="tab-section-title">🎯 Wishlist ({wishlist.length})</h2>
            {renderMovieGrid(wishlist, 'wishlist')}
          </div>
        )}
        {activeTab === 'favourites' && (
          <div className="profile-tab-content">
            <h2 className="tab-section-title">❤️ Favourites ({favourites.length})</h2>
            {renderMovieGrid(favourites, 'favourites')}
          </div>
        )}
        {activeTab === 'ratings' && renderRatings()}
        {activeTab === 'people' && renderFavouritePeople()}
        {activeTab === 'interests' && renderInterests()}
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </div>
  );
};

export default ProfilePage;

// this app is great for recording my face :)
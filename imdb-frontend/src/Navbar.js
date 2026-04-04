import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import NotificationsDropdown from './components/Navbar/NotificationsDropdown';
import MessengerPanel from './components/Social/MessengerPanel';

const API_BASE = 'http://localhost:5000/api';

function Navbar({ user, onLogout, onLoginClick, onSearch }) {

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const navigate = useNavigate();

  // Search suggestions state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // Hover tooltip state for suggestions
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [tooltipIndex, setTooltipIndex] = useState(-1);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const clampPos = (x, y) => {
    const pad = 12;
    const tooltipW = 320;
    const tooltipH = 180;
    const maxX = Math.max(pad, window.innerWidth - tooltipW - pad);
    const maxY = Math.max(pad, window.innerHeight - tooltipH - pad);
    return {
      x: Math.min(Math.max(x, pad), maxX),
      y: Math.min(Math.max(y, pad), maxY)
    };
  };

  // Debounced fetch for suggestions
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/movies/search?q=${encodeURIComponent(searchQuery)}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (e) {
        setSuggestions([]);
      }
    }, 200);

    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!showSuggestions) return;
      const inInput = inputRef.current && inputRef.current.contains(e.target);
      const inDrop = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inInput && !inDrop) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showSuggestions]);

  const gotoMovie = (id) => {
    setShowSuggestions(false);
    setSuggestions([]);
    navigate(`/movie/${id}`);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (suggestions[highlighted]) {
        e.preventDefault();
        gotoMovie(suggestions[highlighted].id);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const goToProfileTab = (tab) => {
    navigate(`/profile?tab=${tab}`);
  };

  return (
    <>
    <nav className="navbar">
      
      {/* Hamburger Icon */}
      <div 
        className="navbar__hamburger" 
        onClick={() => setIsMenuOpen(true)} 
      >
        ☰
      </div>

      <div className="navbar__logo">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>🎬 PopCorn</Link>
      </div>
      
      <div className="navbar__search">
        <input
          type="text"
          placeholder="Search movies, series..."
          value={searchQuery || ''}
          onChange={(e)=> {
            const v = e.target.value;
            setSearchQuery(v);
            onSearch(v);
            setShowSuggestions(!!v.trim());
          }}
          onFocus={() => setShowSuggestions(!!searchQuery.trim())}
          onKeyDown={handleKeyDown}
          ref={inputRef}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="search-suggestions" ref={dropdownRef}>
            {suggestions.map((s, idx) => {
              const poster = s.poster_path
                ? (s.poster_path.startsWith('http') ? s.poster_path : (s.poster_path.startsWith('/') ? `https://image.tmdb.org/t/p/w92${s.poster_path}` : s.poster_path))
                : '';
              const posterLarge = s.poster_path
                ? (s.poster_path.startsWith('http') ? s.poster_path : (s.poster_path.startsWith('/') ? `https://image.tmdb.org/t/p/w154${s.poster_path}` : s.poster_path))
                : '';
              const year = s.release_date ? new Date(s.release_date).getFullYear() : '';
              const rating = typeof s.avg_rating === 'number' ? s.avg_rating.toFixed(1) : null;
              const count = typeof s.rating_count === 'number' ? s.rating_count : null;
              const SHOW_DELAY = 450;
              const HIDE_DELAY = 120;
              const handleEnter = (e) => {
                setHighlighted(idx);
                setHoverIndex(idx);
                if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
                if (showTimerRef.current) clearTimeout(showTimerRef.current);
                const base = clampPos(e.clientX + 12, e.clientY + 12);
                setTooltipPos(base);
                showTimerRef.current = setTimeout(() => {
                  setTooltipIndex(idx);
                  showTimerRef.current = null;
                }, SHOW_DELAY);
              };
              const handleMove = (e) => {
                if (hoverIndex === idx || tooltipIndex === idx) {
                  const pos = clampPos(e.clientX + 12, e.clientY + 12);
                  setTooltipPos(pos);
                }
              };
              const handleLeave = () => {
                setHoverIndex(-1);
                if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                hideTimerRef.current = setTimeout(() => {
                  setTooltipIndex((t) => (t === idx ? -1 : t));
                  hideTimerRef.current = null;
                }, HIDE_DELAY);
              };

              const snippet = (s.overview || '').length > 220 ? (s.overview || '').slice(0, 217) + '…' : (s.overview || '');

              return (
                <li
                  key={s.id}
                  className={idx === highlighted ? 'highlighted' : ''}
                  onMouseDown={() => gotoMovie(s.id)}
                  onPointerEnter={handleEnter}
                  onPointerMove={handleMove}
                  onPointerLeave={handleLeave}
                >
                  <div className="suggestion-item">
                    {poster ? (
                      <img className="suggestion-thumb" src={poster} alt={s.title} />
                    ) : (
                      <div className="suggestion-thumb placeholder">🎬</div>
                    )}
                    <div className="suggestion-text">
                      <div className="suggestion-title">{s.title}</div>
                      <div className="suggestion-sub">Movie{year ? ` • ${year}` : ''}</div>
                    </div>

                    {tooltipIndex === idx && (
                      <div
                        className="suggestion-tooltip show"
                        style={{ position: 'fixed', left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
                      >
                        <div className="tooltip-row">
                          {posterLarge ? (
                            <img className="tooltip-poster" src={posterLarge} alt={s.title} />
                          ) : (
                            <div className="tooltip-poster" style={{display:'grid',placeItems:'center'}}>🎬</div>
                          )}
                          <div className="tooltip-content">
                            <div className="tooltip-title">{s.title}</div>
                            <div className="tooltip-meta">
                              <span>Movie</span>
                              {year && <span>• {year}</span>}
                              {rating !== null && (
                                <span className="meta-pill">⭐ {rating}</span>
                              )}
                              {count !== null && count > 0 && (
                                <span>({count})</span>
                              )}
                            </div>
                            {snippet && (
                              <div className="tooltip-overview">{snippet}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      <div className="navbar__menu">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}><span>Home</span></Link>
        <Link to="/movies" style={{ textDecoration: 'none', color: 'inherit' }}><span>Movies</span></Link>
        <Link to="/browse" className="nav-browse-link" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>Browse</span>
        </Link>
        <Link to="/series" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>Series</span>
        </Link>
        <Link to="/social" style={{ textDecoration: 'none', color: 'inherit' }}><span>Social</span></Link>
        
        {user ? (
          <>
            <span className="nav-link" onClick={() => setIsMessengerOpen(true)} style={{ cursor: 'pointer' }}>💬</span>
            <NotificationsDropdown />
            <div className="profile-menu-container">
              <div className="profile-avatar">
                {user.profile_picture ? (
                  <img src={user.profile_picture} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
              </div>

              {/* Hover-based dropdown */}
              <div className="dropdown-menu">
                <ul>
                  <li onClick={() => goToProfileTab('overview')}>👤 Profile</li>
                  <li onClick={() => goToProfileTab('watchlist')}>📋 Watchlist</li>
                  <li onClick={() => goToProfileTab('wishlist')}>🎯 Wishlist</li>
                  <li onClick={() => goToProfileTab('ratings')}>⭐ Ratings</li>
                  <li onClick={() => goToProfileTab('stats')}>📊 Stats</li>
                  <li onClick={() => goToProfileTab('people')}>🌟 Favourite People</li>
                  <li onClick={() => goToProfileTab('interests')}>🎭 Interests</li>
                  <li onClick={() => goToProfileTab('settings')}>⚙️ Settings</li>
                  {user.is_admin && (
                    <li onClick={() => navigate('/admin')} style={{ color: '#ff3b30', fontWeight: 'bold' }}>👑 Admin Panel</li>
                  )}
                  <div className="divider"></div>
                  <li className="logout-text" onClick={() => {
                    onLogout(); 
                  }}>
                    Logout
                  </li>
                </ul>
              </div>
            </div>
          </>
        ) : (
          <span className="nav-link" onClick={onLoginClick} style={{ cursor: 'pointer' }}>
            Login
          </span>
        )}
      </div>
    </nav>

    {/* Sidebar */}
    <div className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
      <button className="sidebar__close" onClick={() => setIsMenuOpen(false)}>
        &times;                                                               
      </button>
      <div className="sidebar__content">
        <h3>Discover</h3>
        <Link to="/people" onClick={() => setIsMenuOpen(false)}>🔍 Find People</Link>
        <Link to="/movies" onClick={() => setIsMenuOpen(false)}>🎬 Top Movies</Link>
        <Link to="/series" onClick={() => setIsMenuOpen(false)}>📺 Series</Link>
        <Link to="/crews" onClick={() => setIsMenuOpen(false)}>🎭 Crews</Link>
      </div>
    </div>

    {isMenuOpen && (
      <div className="sidebar-overlay" onClick={() => setIsMenuOpen(false)}></div>
    )}
    
    <MessengerPanel user={user} isOpen={isMessengerOpen} onClose={() => setIsMessengerOpen(false)} />
    </>
  );
}

export default Navbar;

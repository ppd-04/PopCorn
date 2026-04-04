import React, { useState, useEffect, useRef } from 'react'; // ---> CHANGED: Added useState, useEffect, useRef <---
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import NotificationsDropdown from './components/Navbar/NotificationsDropdown';
import MessengerPanel from './components/Social/MessengerPanel';

const API_BASE = 'http://localhost:5000/api';

function Navbar({ user, onLogout, onLoginClick, theme, toggleTheme, onSearch }) {

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
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
    const tooltipW = 320; // match CSS width
    const tooltipH = 180; // approximate height; will safely clamp
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
        // silent fail for UX
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
    setIsProfileDropdownOpen(false);
    navigate(`/profile?tab=${tab}`);
  };

  return (
    <> {/* ---> ADDED: Fragment wrapper to hold both the nav and the sidebar <--- */}
    <nav className={`navbar ${theme}`}>
      
      {/* ---> ADDED: The Hamburger Icon <--- */}
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
          <ul className={`search-suggestions ${theme}`} ref={dropdownRef}>
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
              const SHOW_DELAY = 450; // ms (typical UX range: 350–500)
              const HIDE_DELAY = 120;
              const handleEnter = (e) => {
                setHighlighted(idx);
                setHoverIndex(idx);
                if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
                if (showTimerRef.current) clearTimeout(showTimerRef.current);
                // Show immediately and position near the pointer
                const base = clampPos(e.clientX + 12, e.clientY + 12);
                setTooltipPos(base);
                showTimerRef.current = setTimeout(() => {
                  setTooltipIndex(idx);
                  showTimerRef.current = null;
                }, SHOW_DELAY);
              };
              const handleMove = (e) => {
                if (hoverIndex === idx||tooltipIndex === idx) {
                  const pos = clampPos(e.clientX + 12, e.clientY + 12);
                  setTooltipPos(pos);
                }
              };
              const handleLeave = () => {
                setHoverIndex(-1);
                if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
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

                    {/* Hover tooltip (positioned at pointer) */}
                    {tooltipIndex === idx && (
                      <div
                        className={`suggestion-tooltip show`}
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
        
        {/* Theme Toggle */}
        <span className="nav-link" onClick={toggleTheme} style={{ cursor: 'pointer' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </span>
        
        {user ? (
          <>
            <span className="nav-link" onClick={() => setIsMessengerOpen(true)} style={{ cursor: 'pointer' }}>💬</span>
            <NotificationsDropdown theme={theme} />
            <div className="profile-menu-container">
            
            {/* The Avatar (Clickable Trigger) */}
            <div 
              className="profile-avatar"
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              {/* Shows profile pic or first letter */}
              {user.profile_picture ? (
                <img src={user.profile_picture} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                user.username.charAt(0).toUpperCase()
              )}
            </div>

            {/* The Dropdown Menu */}
            {isProfileDropdownOpen && (
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
                    <li onClick={() => { setIsProfileDropdownOpen(false); navigate('/admin'); }} style={{ color: '#ff3b30', fontWeight: 'bold' }}>👑 Admin Panel</li>
                  )}
                  <div className="divider"></div>
                  {/* Notice we call onLogout() here now */}
                  <li className="logout-text" onClick={() => {
                    setIsProfileDropdownOpen(false);
                    onLogout(); 
                  }}>
                    Logout
                  </li>
                </ul>
              </div>
            )}
          </div>
          </>
        ) : (
          <span className="nav-link" onClick={onLoginClick} style={{ cursor: 'pointer' }}>
            Login
          </span>
        )}
      </div>
    </nav>

    {/* ---> ADDED: The hidden sidebar and dark overlay UI <--- */}
    <div className={`sidebar ${isMenuOpen ? 'open' : ''} ${theme}`}>
      <button className="sidebar__close" onClick={() => setIsMenuOpen(false)}>
        &times;                                                               
      </button>
      <div className="sidebar__content">
        <h3>Discover</h3>
        <Link to="/people" onClick={() => setIsMenuOpen(false)}>🔍 Find People</Link>
        <Link to="/top-movies" onClick={() => setIsMenuOpen(false)}>Top Movies</Link>
        <Link to="/popular" onClick={() => setIsMenuOpen(false)}>Popular Movies</Link>
        <Link to="/actors" onClick={() => setIsMenuOpen(false)}>Actors</Link>
        <Link to="/directors" onClick={() => setIsMenuOpen(false)}>Directors</Link>
        {/* adding later */}
        <Link to="/crews" onClick={() => setIsMenuOpen(false)}>Crews</Link>
        <Link to="/writers" onClick={() => setIsMenuOpen(false)}>Writers</Link>


        <Link to="/celebrities" onClick={() => setIsMenuOpen(true)}>Celebrities</Link>
      </div>
    </div>

    {/* The overlay darkens the rest of the screen and closes the menu if clicked */}
    {isMenuOpen && (
      <div className="sidebar-overlay" onClick={() => setIsMenuOpen(false)}></div>
    )}
    
    <MessengerPanel user={user} isOpen={isMessengerOpen} onClose={() => setIsMessengerOpen(false)} />
    </>
  );
}

export default Navbar;

// import React from 'react';
// import { Link } from 'react-router-dom';
// import './Navbar.css';

// function Navbar({ user, onLogout, onLoginClick, theme, toggleTheme, onSearch }) {
//   return (
//     <nav className={`navbar ${theme}`}>
//       <div className="navbar__logo">
//         <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>🎬 PopCorn</Link>
//       </div>
      
//       <div className="navbar__search">
//         <input
//           type="text"
//           placeholder="Search movies, series..."
//           onChange={(e)=>onSearch(e.target.value)}
//         />
//       </div>
      
//       <div className="navbar__menu">
//         <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}><span>Home</span></Link>
//         <Link to="/movies" style={{ textDecoration: 'none', color: 'inherit' }}><span>Movies</span></Link>
//         <span>Series</span>
        
//         {/* Theme Toggle */}
//         <span className="nav-link" onClick={toggleTheme} style={{ cursor: 'pointer' }}>
//           {theme === 'dark' ? '☀️' : '🌙'}
//         </span>
        
//         {user ? (
//           <span className="nav-link" onClick={onLogout} style={{ cursor: 'pointer' }}>
//             Logout ({user.username})
//           </span>
//         ) : (
//           <span className="nav-link" onClick={onLoginClick} style={{ cursor: 'pointer' }}>
//             Login
//           </span>
//         )}
//       </div>
//     </nav>
//   );
// }

// export default Navbar;


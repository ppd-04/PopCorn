import React, { useState } from 'react'; // ---> CHANGED: Added useState <---
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

function Navbar({ user, onLogout, onLoginClick, theme, toggleTheme, onSearch }) {

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const navigate = useNavigate();


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
          onChange={(e)=>onSearch(e.target.value)}
        />
      </div>
      
      <div className="navbar__menu">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}><span>Home</span></Link>
        <Link to="/movies" style={{ textDecoration: 'none', color: 'inherit' }}><span>Movies</span></Link>
        <span>Series</span>
        <Link to="/social" style={{ textDecoration: 'none', color: 'inherit' }}><span>Social</span></Link>
        
        {/* Theme Toggle */}
        <span className="nav-link" onClick={toggleTheme} style={{ cursor: 'pointer' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </span>
        
        {user ? (
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
        <Link to="/top-movies" onClick={() => setIsMenuOpen(false)}>Top Movies</Link>
        <Link to="/popular" onClick={() => setIsMenuOpen(false)}>Popular Movies</Link>
        <Link to="/actors" onClick={() => setIsMenuOpen(false)}>Actors</Link>
        <Link to="/directors" onClick={() => setIsMenuOpen(false)}>Directors</Link>
        {/* adding later */}
        <Link to="/crews" onClick={() => setIsMenuOpen(false)}>Crews</Link>
        <Link to="/writers" onClick={() => setIsMenuOpen(false)}>Writers</Link>


        <Link to="/celebrities" onClick={() => setIsMenuOpen(false)}>Celebrities</Link>
      </div>
    </div>

    {/* The overlay darkens the rest of the screen and closes the menu if clicked */}
    {isMenuOpen && (
      <div className="sidebar-overlay" onClick={() => setIsMenuOpen(false)}></div>
    )}
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


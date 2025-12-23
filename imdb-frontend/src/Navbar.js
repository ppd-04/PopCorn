import React from 'react';
import './Navbar.css'; 

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar__logo">
        🎬 PopCorn
      </div>
      
      <div className="navbar__search">
        <input
          type="text"
          placeholder="Search for movies, series..."
        />
      </div>
      
      <div className="navbar__menu">
        <span>Home</span>
        <span>Movies</span>
        <span>Series</span>
        <span>Watchlist</span>
      </div>
    </nav>
  );
}

export default Navbar;

import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css';
import './HomePage.css';
import Navbar from './Navbar';
import LoginForm from './components/Auth/LoginForm';
import MovieFeed from './components/MovieFeed';
import { Routes, Route, Link } from 'react-router-dom';
import MovieDetails from './components/MovieDetails';
import SocialFeed from './components/Social/SocialFeed';
import ProfilePage from './components/Profile/ProfilePage';
import ChatPanel from './components/Chat/ChatPanel';
import AdminDashboard from './components/Admin/AdminDashboard';
import BrowsePage from './components/Browse/BrowsePage';
import SeriesPage from './components/Series/SeriesPage';
import SeriesDetails from './components/Series/SeriesDetails';
import Celebrities from './components/celebrities/celebrities';
import PublicProfile from './components/User/PublicProfile';
import PeopleSearch from './components/Social/PeopleSearch';
import DiscussionRoom from './components/Social/DiscussionRoom';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import CrewsPage from './components/Crews/CrewsPage';
import PersonDetails from './components/Crews/PersonDetails';
import GenreRows from './components/Home/GenreRows';
import TrailerRow from './components/Home/TrailerRow';
// import InteractiveBackground from './components/InteractiveBackground';

const HERO_BACKDROPS = [
  'https://image.tmdb.org/t/p/original/8Y43POKjjKDGI9mh89NW0Pn1Z.jpg', // Interstellar
  'https://image.tmdb.org/t/p/original/r1mweSwH225GZf3sD7D1b8s3Wl0.jpg', // Dune
  'https://image.tmdb.org/t/p/original/mZjZgY6ObiKtVuKVDrnS9VnuNlE.jpg', // The Dark Knight
  'https://image.tmdb.org/t/p/original/5mzr6JZbrqnqD8rCEvPhuCE5Fw2.jpg', // Gladiator
  'https://image.tmdb.org/t/p/original/nDLylQOoI8yWdX2eE2dJgtoxtn4.jpg'  // The Matrix
];

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [heroBg, setHeroBg] = useState('');

  //  dark mode
  useEffect(() => {
    document.body.className = 'dark';
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    async function fetchRandomBg() {
      try {
        const { data, error } = await supabase
          .from('movies')
          .select('backdrop_path, movie_genres(genres(name))')
          .not('backdrop_path', 'is', null)
          .order('popularity', { ascending: false })
          .limit(50);

        if (data && !error && data.length > 0) {

          const safeMovies = data.filter(m => {
            if (!m.movie_genres) return true;
            return !m.movie_genres.some(mg => mg.genres && mg.genres.name.toLowerCase() === 'romance');
          });

          if (safeMovies.length > 0) {
            const randomMovie = safeMovies[Math.floor(Math.random() * safeMovies.length)];
            const path = randomMovie.backdrop_path;
            const fullUrl = path.startsWith('http') ? path : `https://image.tmdb.org/t/p/original${path}`;
            setHeroBg(fullUrl);
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching hero bg:", err);
      }
      setHeroBg(HERO_BACKDROPS[Math.floor(Math.random() * HERO_BACKDROPS.length)]);
    }
    fetchRandomBg();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <div className="App">
      {/* <InteractiveBackground /> */}
      <Navbar
        user={user}
        onLogout={handleLogout}
        onLoginClick={() => setShowLogin(true)}
        onSearch={setSearchTerm}
      />

      {showLogin && (
        <LoginForm
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setShowLogin(false)}
        />
      )}

      {!showLogin && (
        <>
          <Routes>
            <Route path="/" element={
              <>
                {/* Hero Welcome Section */}
                <div className="hero" style={heroBg ? { backgroundImage: `linear-gradient(to right, rgba(0, 0, 0, 0.95) 20%, rgba(0, 0, 0, 0.4) 100%), url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '80vh' } : {}}>
                  <div className="hero__content">
                    <h1 className="hero__title">Welcome to PopCorn</h1>
                    <p className="hero__subtitle">
                      Discover the best movies and series in PopCorn.
                      Track what you've watched and what to watch next.
                    </p>
                    <div className="hero__buttons">
                      <Link to="/movies" style={{ textDecoration: 'none' }}>
                        <button className="btn btn-primary">Wander Through Cinematic Realms</button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Guidelines Section */}
                <div className="guidelines-section">
                  <h2>🍿 How to Use PopCorn</h2>
                  <div className="guidelines-grid">
                    <div className="guideline-card">
                      <span className="guideline-icon">🎬</span>
                      <h3>Browse Movies</h3>
                      <p>Explore thousands of movies filtered by genre, rating, and year. Click any movie for full details, trailers, and reviews.</p>
                    </div>
                    <div className="guideline-card">
                      <span className="guideline-icon">📺</span>
                      <h3>Discover Series</h3>
                      <p>Dive into top-rated series with season details, episode counts, and ratings. Find your next binge-worthy show.</p>
                    </div>
                    <div className="guideline-card">
                      <span className="guideline-icon">📋</span>
                      <h3>Build Your Watchlist</h3>
                      <p>Create a personal watchlist to track movies and shows you want to watch. Never lose track of great content again.</p>
                    </div>
                    <div className="guideline-card">
                      <span className="guideline-icon">⭐</span>
                      <h3>Rate & Review</h3>
                      <p>Share your thoughts by rating and commenting on movies. Help the community discover hidden gems!</p>
                    </div>
                    <div className="guideline-card">
                      <span className="guideline-icon">🤖</span>
                      <h3>AI Recommendations</h3>
                      <p>Get personalized movie suggestions powered by AI. The more you interact, the smarter it becomes.</p>
                    </div>
                    <div className="guideline-card">
                      <span className="guideline-icon">👥</span>
                      <h3>Connect with Fans</h3>
                      <p>Join the social feed, create posts, find people with similar taste, and chat with the community.</p>
                    </div>
                  </div>
                </div>

                <TrailerRow />

                <GenreRows />
              </>
            } />

            <Route path="/movies" element={<MovieFeed searchTerm={searchTerm} />} />
            <Route path="/browse" element={<BrowsePage user={user} />} />
            <Route path="/movie/:id" element={<MovieDetails user={user} />} />
            <Route path="/social" element={<SocialFeed user={user} />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/series/:id" element={<SeriesDetails user={user} />} />
            <Route path="/celebrities" element={<Celebrities />} />
            <Route path="/user/:id" element={<PublicProfile currentUser={user} />} />
            <Route path="/people" element={<PeopleSearch />} />
            <Route path="/crews" element={<CrewsPage />} />
            <Route path="/person/:id" element={<PersonDetails />} />

            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage user={user} setUser={setUser} />
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute>
                {user && user.is_admin ? <AdminDashboard /> : <div style={{ padding: '100px', textAlign: 'center', color: 'red', fontWeight: 'bold' }}>Access denied. Admins only.</div>}
              </ProtectedRoute>
            } />

            <Route path="/watchlist" element={
              <ProtectedRoute>
                <div className="container" style={{ paddingTop: '100px', minHeight: '60vh' }}>
                  <h2 className="section-title">My Watchlist</h2>
                  <p style={{ color: 'var(--text-color)' }}>
                    🔒 This is a secure page! Only authenticated users like you can see this.
                  </p>
                </div>
              </ProtectedRoute>
            } />

            <Route path="/social/discussion/:id" element={<DiscussionRoom user={user} />} />
          </Routes>

          <footer className="footer">
            <div className="container" style={{ background: 'transparent' }}>
              <div className="footer-content">
                <div className="footer-section">
                  <h3>PopCorn</h3>
                  <p>An ultimate movie discovery platform built for CSE DBMS project.</p>
                </div>

                <div className="footer-section">
                  <h4>Quick Links</h4>
                  <ul>
                    <li><Link to="/" className="footer-link">Home</Link></li>
                    <li><Link to="/movies" className="footer-link">Movies</Link></li>
                    <li><Link to="/series" className="footer-link">Series</Link></li>
                    <li>
                      {user ? (
                        <Link to="/watchlist" className="footer-link">Watchlist</Link>
                      ) : (
                        <span className="footer-link" onClick={() => setShowLogin(true)}>Login</span>
                      )}
                    </li>
                  </ul>
                </div>

                <div className="footer-section">
                  <h4>Contact Us</h4>
                  <ul>
                    <li>📧 2305060@ugrad.cse.buet.ac.bd</li>
                    <li>📱 +8801870212198</li>
                    <li>🌐 Dhaka, Bangladesh</li>
                  </ul>
                </div>

                <div className="footer-section">
                  <h4>Follow Us</h4>
                  <div className="social-links">
                    <button className="footer-link">📘 Facebook</button>
                    <button className="footer-link">📱 Instagram</button>
                    <button className="footer-link">🐦 Twitter</button>
                  </div>
                </div>
              </div>

              <div className="footer-bottom">
                <p>&copy; 2025 PopCorn. Developed by <strong>Praggo & Fahmid</strong>. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </>
      )}

      {!chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)} title="Chat with PopCorn AI">💬</button>
      )}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import './App.css';
import Navbar from './Navbar';
import MovieCard from './MovieCard';
import LoginForm from './components/Auth/LoginForm';
import MovieFeed from './components/MovieFeed';
import { Routes, Route } from 'react-router-dom';
import MovieDetails from './components/MovieDetails';
import SocialFeed from './components/Social/SocialFeed';
import ProfilePage from './components/Profile/ProfilePage';

import ProtectedRoute from './components/Auth/ProtectedRoute';

function App() {
  // database diyekoraalagbe

  const [searchTerm, setSearchTerm] = useState("");

  const spotlightMovies = [
    {
      id: 1,  
      title: "Interstellar",
      poster: "/images/interstellar.jpg",
      rating: 8.7
    },
    {
      id: 2,
      title: "Titanic",
      poster: "https://image.tmdb.org/t/p/w500/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg",
      rating: 7.9
    },
    {
      id: 3,
      title: "3 Idiots",
      poster: "/images/ThreeIdiots.jpg",
      rating: 8.4
    },
    {
      id: 4,
      title: "Inception",
      poster: "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
      rating: 8.8
    },
    {
      id: 5,
      title: "The Dark Knight",
      poster: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
      rating: 9.0
    },
    {
      id: 6,
      title: "Forrest Gump",
      poster: "https://image.tmdb.org/t/p/w500/clolk7rBwRiDqy5QMk4q3nOTeI.jpg",
      rating: 8.8
    },
    {
      id: 7,
      title: "The Shawshank Redemption",
      poster: "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
      rating: 9.3
    },
    {
      id: 8,
      title: "Schindler's List",
      poster: "https://image.tmdb.org/t/p/w500/sF1U4EUQS8YHUYjNl3pMGNIQywV.jpg",
      rating: 9.0
    },
    {
      id: 9,
      title: "Fight Club",
      poster: "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6BfiJpuDV5VQFul0I.jpg",
      rating: 8.8
    },
    {
      id: 10,
      title: "The Godfather",
      poster: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
      rating: 9.2
    }
  ];

  const [user, setUser] = useState(null);

  // light theme add 
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.body.className = savedTheme;
  }, []);

  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); // Added this to properly clear the JWT on logout
    localStorage.removeItem('user');
    setUser(null);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.body.className = newTheme;
  };

  return (
    <div className={`App ${theme}`}>
      <Navbar
        user={user}
        onLogout={handleLogout}
        onLoginClick={() => setShowLogin(true)}
        theme={theme}
        toggleTheme={toggleTheme}
        onSearch={setSearchTerm}
      />


      {/* kemne  */}
      {/* login form take homepage er upor overlap korar jonno */}
      {showLogin && (

        <LoginForm
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setShowLogin(false)}
        />
      )}
      {/* login er time e etuk hidden thakbe */}

      {!showLogin && (
        <>
          <Routes>            
            <Route path="/" element={
              <>
                
                <div className="theme-toggle-container">
                  <button className="theme-toggle-btn" onClick={toggleTheme}>
                    {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                  </button>
                </div>

                <div className="hero">
                  <div className="hero__content">
                    <h1 className="hero__title">Welcome to PopCorn</h1>
                    <p className="hero__subtitle">
                      Discover the best movies and series in PopCorn.
                      Track what you've watched and what to watch next.
                    </p>
                    <div className="hero__buttons">
                      <button className="btn btn-primary">Wander Through Cinematic Realms</button>
                      <button className="btn btn-secondary">
                        {user ? `My Watchlist (${user.username})` : 'My Movie Treasury'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Spotlight Section */}
                <div className="container">
                  <h2 className="section-title">
                    Spotlight ({spotlightMovies.length} movies)
                    {user && <span className="user-welcome">👋 {user.username || user.email.split('@')[0]}</span>}
                  </h2>
                  <div className="movie-grid">
                    {spotlightMovies.map(movie => (
                      <MovieCard key={movie.id} movie={movie} />
                    ))}
                  </div>
                </div>

                {/* <MovieFeed /> 
                    */}
                <MovieFeed searchTerm={searchTerm} />
              </>
            } />

            {/* THIS IS THE NEW MOVIES PAGE ROUTE */}
            <Route path="/movies" element={<MovieFeed searchTerm={searchTerm} />} />

            {/* THIS IS THE NEW MOVIE DETAILS ROUTE */}
            <Route path="/movie/:id" element={<MovieDetails user={user} />} />

            {/* THIS IS THE NEW SOCIAL FEED ROUTE */}
            <Route path="/social" element={<SocialFeed user={user} />} />

            {/* PROFILE PAGE ROUTE */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage user={user} setUser={setUser} />
              </ProtectedRoute>
            } />

            {/* THIS IS THE NEW PROTECTED WATCHLIST ROUTE */}
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
          </Routes>

          <footer className="footer">
            <div className="container">
              <div className="footer-content">
                <div className="footer-section">
                  <h3>PopCorn</h3>
                  <p>An ultimate movie discovery platform built for CSE DBMS project.</p>
                </div>

                <div className="footer-section">
                  <h4>Quick Links</h4>
                  <ul>
                    <li><span className="footer-link">Home</span></li>
                    <li><span className="footer-link">Movies</span></li>
                    <li><span className="footer-link">Series</span></li>
                    <li><span className="footer-link">{user ? 'Watchlist' : 'Login'}</span></li>
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
    </div>
  );
}

export default App;


// import React, { useState, useEffect } from 'react';
// import './App.css';
// import Navbar from './Navbar';
// import MovieCard from './MovieCard';
// import LoginForm from './components/Auth/LoginForm';
// import MovieFeed from './components/MovieFeed';
// import { Routes, Route } from 'react-router-dom';
// import MovieDetails from './components/MovieDetails';

// import ProtectedRoute from './components/Auth/ProtectedRoute';

// function App() {
//   // database diyekoraalagbe

//   const [searchTerm, setSearchTerm] = useState("");

//   const spotlightMovies = [
//     {
//       id: 1,
//       title: "Interstellar",
//       poster: "/images/interstellar.jpg",
//       rating: 8.7
//     },
//     {
//       id: 2,
//       title: "Titanic",
//       poster: "https://image.tmdb.org/t/p/w500/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg",
//       rating: 7.9
//     },
//     {
//       id: 3,
//       title: "3 Idiots",
//       poster: "/images/ThreeIdiots.jpg",
//       rating: 8.4
//     },
//     {
//       id: 4,
//       title: "Inception",
//       poster: "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
//       rating: 8.8
//     },
//     {
//       id: 5,
//       title: "The Dark Knight",
//       poster: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
//       rating: 9.0
//     },
//     {
//       id: 6,
//       title: "Forrest Gump",
//       poster: "https://image.tmdb.org/t/p/w500/clolk7rBwRiDqy5QMk4q3nOTeI.jpg",
//       rating: 8.8
//     },
//     {
//       id: 7,
//       title: "The Shawshank Redemption",
//       poster: "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
//       rating: 9.3
//     },
//     {
//       id: 8,
//       title: "Schindler's List",
//       poster: "https://image.tmdb.org/t/p/w500/sF1U4EUQS8YHUYjNl3pMGNIQywV.jpg",
//       rating: 9.0
//     },
//     {
//       id: 9,
//       title: "Fight Club",
//       poster: "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6BfiJpuDV5VQFul0I.jpg",
//       rating: 8.8
//     },
//     {
//       id: 10,
//       title: "The Godfather",
//       poster: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
//       rating: 9.2
//     }
//   ];

//   const [user, setUser] = useState(null);

//   // light theme add 
//   const [theme, setTheme] = useState('dark');
//   useEffect(() => {
//     const savedTheme = localStorage.getItem('theme') || 'dark';
//     setTheme(savedTheme);
//     document.body.className = savedTheme;
//   }, []);

//   const [showLogin, setShowLogin] = useState(false);

//   useEffect(() => {

//     const storedUser = localStorage.getItem('user');
//     if (storedUser) {
//       setUser(JSON.parse(storedUser));
//     }
//   }, []);

//   const handleLoginSuccess = (userData) => {
//     setUser(userData);
//     setShowLogin(false);
//   };

//   const handleLogout = () => {
//     localStorage.removeItem('user');
//     setUser(null);
//   };

//   const toggleTheme = () => {
//     const newTheme = theme === 'dark' ? 'light' : 'dark';
//     setTheme(newTheme);
//     localStorage.setItem('theme', newTheme);
//     document.body.className = newTheme;
//   };

//   return (
//     <div className={`App ${theme}`}>
//       <Navbar
//         user={user}
//         onLogout={handleLogout}
//         onLoginClick={() => setShowLogin(true)}
//         theme={theme}
//         toggleTheme={toggleTheme}
//         onSearch={setSearchTerm}
//       />


//       {/* kemne  */}
//       {/* login form take homepage er upor overlap korar jonno */}
//       {showLogin && (

//         <LoginForm
//           onLoginSuccess={handleLoginSuccess}
//           onClose={() => setShowLogin(false)}
//         />
//       )}
//       {/* login er time e etuk hidden thakbe */}

//       {!showLogin && (
//         <>
//           <Routes>            
//             <Route path="/" element={
//               <>
                
//                 <div className="theme-toggle-container">
//                   <button className="theme-toggle-btn" onClick={toggleTheme}>
//                     {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
//                   </button>
//                 </div>

//                 <div className="hero">
//                   <div className="hero__content">
//                     <h1 className="hero__title">Welcome to PopCorn</h1>
//                     <p className="hero__subtitle">
//                       Discover the best movies and series in PopCorn.
//                       Track what you've watched and what to watch next.
//                     </p>
//                     <div className="hero__buttons">
//                       <button className="btn btn-primary">Wander Through Cinematic Realms</button>
//                       <button className="btn btn-secondary">
//                         {user ? `My Watchlist (${user.username})` : 'My Movie Treasury'}
//                       </button>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Spotlight Section */}
//                 <div className="container">
//                   <h2 className="section-title">
//                     Spotlight ({spotlightMovies.length} movies)
//                     {user && <span className="user-welcome">👋 {user.username}</span>}
//                   </h2>
//                   <div className="movie-grid">
//                     {spotlightMovies.map(movie => (
//                       <MovieCard key={movie.id} movie={movie} />
//                     ))}
//                   </div>
//                 </div>

//                 {/* <MovieFeed /> 
//                     */}
//                 <MovieFeed searchTerm={searchTerm} />
//               </>
//             } />

//             {/* THIS IS THE NEW MOVIES PAGE ROUTE */}
//             <Route path="/movies" element={<MovieFeed searchTerm={searchTerm} />} />

//             {/* THIS IS THE NEW MOVIE DETAILS ROUTE */}
//             <Route path="/movie/:id" element={<MovieDetails />} />
//           </Routes>

//           <footer className="footer">
//             <div className="container">
//               <div className="footer-content">
//                 <div className="footer-section">
//                   <h3>PopCorn</h3>
//                   <p>An ultimate movie discovery platform built for CSE DBMS project.</p>
//                 </div>

//                 <div className="footer-section">
//                   <h4>Quick Links</h4>
//                   <ul>
//                     <li><span className="footer-link">Home</span></li>
//                     <li><span className="footer-link">Movies</span></li>
//                     <li><span className="footer-link">Series</span></li>
//                     <li><span className="footer-link">{user ? 'Watchlist' : 'Login'}</span></li>
//                   </ul>
//                 </div>

//                 <div className="footer-section">
//                   <h4>Contact Us</h4>
//                   <ul>
//                     <li>📧 2305060@ugrad.cse.buet.ac.bd</li>
//                     <li>📱 +8801870212198</li>
//                     <li>🌐 Dhaka, Bangladesh</li>
//                   </ul>
//                 </div>

//                 <div className="footer-section">
//                   <h4>Follow Us</h4>
//                   <div className="social-links">
//                     <button className="footer-link">📘 Facebook</button>
//                     <button className="footer-link">📱 Instagram</button>
//                     <button className="footer-link">🐦 Twitter</button>
//                   </div>
//                 </div>
//               </div>

//               <div className="footer-bottom">
//                 <p>&copy; 2025 PopCorn. Developed by <strong>Praggo & Fahmid</strong>. All rights reserved.</p>
//               </div>
//             </div>
//           </footer>
//         </>
//       )}
//     </div>
//   );
// }

// export default App;



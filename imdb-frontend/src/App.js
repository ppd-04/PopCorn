import React from 'react';
import './App.css';
import Navbar from './Navbar';

function App() {
  return (
    <div className="App">
      <Navbar />
      
      {/* Hero Section */}
      <div className="hero">
        <div className="hero__content">
          <h1 className="hero__title">Welcome to PopCorn</h1>
          <p className="hero__subtitle">
            Discover the best movies and series in PopCorn. 
            Track what you've watched and what to watch next.
          </p>
          <div className="hero__buttons">
            <button className="btn btn-primary">Wander Through Cinematic Realms</button>
            <button className="btn btn-secondary">My Movie Treasury</button>
          </div>
        </div>
      </div>

      {/* Spotlight Section */}
      <div className="container">
        <h2 className="section-title">Spotlight</h2>
        <div className="movie-grid">
          {/* Interstellar */}
          <div className="movie-card">
            <div className="movie-poster">
              <img src="/images/interstellar.jpg" alt="Interstellar" />
            </div>
            <h3>Interstellar</h3>
            <div className="movie-rating">★ 8.7</div>
          </div>

          {/* Titanic */}
          <div className="movie-card">
            <div className="movie-poster">
              <img src="https://image.tmdb.org/t/p/w500/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg" alt="Titanic" />
            </div>
            <h3>Titanic</h3>
            <div className="movie-rating">★ 7.9</div>
          </div>

          {/* 3 Idiots */}
          <div className="movie-card">
            <div className="movie-poster">
              <img src="/images/ThreeIdiots.jpg" alt="3 Idiots" />
            </div>
            <h3>3 Idiots</h3>
            <div className="movie-rating">★ 8.4</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>PopCorn</h3>
              <p>An ultimate movie discovery platform built for CSE DBMS project.</p>
            </div>
            
            {/* <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#movies">Movies</a></li>
                <li><a href="#series">Series</a></li>
                <li><a href="#watchlist">Watchlist</a></li>
              </ul>
            </div> */}

            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><span className="footer-link">Home</span></li>
                <li><span className="footer-link">Movies</span></li>
                <li><span className="footer-link">Series</span></li>
                <li><span className="footer-link">Watchlist</span></li>
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
            {/* eta genjam kore kn -_- */}
            {/* <div className="footer-section">
              <h4>Follow Us</h4>
              <div className="social-links">
                <a href="#">📘 Facebook</a>
                <a href="#">📱 Instagram</a>
                <a href="#">🐦 Twitter</a>
              </div>
            </div> */}

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
    </div>
  );
}

export default App;


// import React from 'react';
// import './App.css';
// import Navbar from './Navbar';

// function App() {
//   return (
//     <div className="App">
//       <Navbar />
      
//       {/* Hero Section */}
//       <div className="hero">
//         <div className="hero__content">
//           <h1 className="hero__title">Welcome to PopCorn</h1>
//           <p className="hero__subtitle">
//             Discover the best movies and series in PopCorn. 
//             Track what you've watched and what to watch next.
//           </p>
//           <div className="hero__buttons">
//             <button className="btn btn-primary">Wander Through Cinematic Realms</button>
//             <button className="btn btn-secondary">My Movie Treasury</button>
//           </div>
//         </div>
//       </div>

//       {/* ekhane trending movie gula thakbe, tbd r moto */}
//       <div className="container">
//         <h2 className="section-title">Spotlight</h2>
//         <div className="movie-grid">
//           {/* Interstellar  */}
//           <div className="movie-card">
//             <div className="movie-poster">
//               <img 
//                 src="/images/interstellar.jpg" 
//                 alt="Interstellar" 
//               />
//             </div>
//             <h3>Interstellar</h3>
//             <div className="movie-rating">★ 8.7</div>
//           </div>

//           {/* Titanic direct website the link hoy  */}
//           <div className="movie-card">
//             <div className="movie-poster">
//               <img 
//                 src="https://image.tmdb.org/t/p/w500/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg" 
//                 alt="Titanic" 
//               />
//             </div>
//             <h3>Titanic</h3>
//             <div className="movie-rating">★ 7.9</div>
//           </div>

//           {/* 3 Idiots */}
//           <div className="movie-card">
//             <div className="movie-poster">
//               <img 
//                 src="/images/ThreeIdiots.jpg" 
//                 alt="3 Idiots" 
//               />
//             </div>
//             <h3>3 Idiots</h3>
//             <div className="movie-rating">★ 8.4</div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default App;






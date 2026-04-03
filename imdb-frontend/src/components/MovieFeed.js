import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient'; 
import { Link } from 'react-router-dom'; 

const MovieFeed = ({ searchTerm }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0); 
  const ITEMS_PER_PAGE = 20;

  // adding later
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [minRating, setMinRating] = useState(0);
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    async function fetchGenres() {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .order('name');
      
      if (!error && data) {
        setGenres(data);
      }
    }
    fetchGenres();
  }, []);

  // eita diye wait koray new page ashar agei, naile search 1 ta page e check kore stuck hoye jay
  useEffect(() => {
    const timer = setTimeout(() => {
        // abar 0 page e back
        fetchMovies(0, true);
    }, 500); // 500 ms delay kore search er jonno, instant hole cholena

    // 500 ms er moddhe search change korle ager searching clear kore fele
    return () => clearTimeout(timer);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedGenre, minRating, minYear, maxYear, sortBy]); // Added selectedGenre here so it triggers a re-fetch


  async function fetchMovies(pageNumberOverride = null, isSearchReset = false) {
    setLoading(true);
    
    const currentPage = pageNumberOverride !== null ? pageNumberOverride : page;
    const from = currentPage * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query;

    if (selectedGenre) {
       query = supabase.from('movies')
                       .select('*, movie_genres!inner(genre_id)')
                       .eq('movie_genres.genre_id', selectedGenre);
    } else {
       // If "All Genres" is selected, just get the normal movies
       query = supabase.from('movies').select('*');
    }

    // Apply the search term if the user is typing
    if(searchTerm) {
       query = query.ilike('title', `%${searchTerm}%`);
    } 

    // rating er jonno filter add kori

    if(minRating>0){
      query = query.gte('vote_average', minRating);
    }

    //year er jonno
    // weird syntax string interpolation er jonno, year month date ei 

    // tomake mone porbe 
    // jokhoni akash venge borsha kade...
    if(minYear){
      query =   query.gte('release_date', `${minYear}-01-01`);
    }

    if(maxYear){
      // CHANGED: Fixed .gte to .lte so it gets movies BEFORE this max year
      query =   query.lte('release_date', `${maxYear}-12-31`); 
    }

    if(sortBy !== 'default'){if (sortBy === 'rating_desc') {
        query = query.order('vote_average', { ascending: false });
    } else if (sortBy === 'rating_asc') {
        query = query.order('vote_average', { ascending: true });
    } else if (sortBy === 'year_desc') {
        query = query.order('release_date', { ascending: false }); // Newest first
    } else if (sortBy === 'year_asc') {
        query = query.order('release_date', { ascending: true }); // Oldest first
    }}else{
      query=query.order('id', {ascending:true});
    }


    
   
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching data:", error);
    } else {
      setMovies((prevMovies) => {
        if (isSearchReset) {
            return data;
        }

        const existingIds = new Set(prevMovies.map(m => m.id));
        const uniqueNewMovies = data.filter(movie => !existingIds.has(movie.id));
        return [...prevMovies, ...uniqueNewMovies];
      });

      if (data.length > 0) {
          setPage(currentPage + 1);
      }
    }
    setLoading(false);
  }



  const selectedGenreName = selectedGenre 
    ? genres.find(g => g.id.toString() === selectedGenre.toString())?.name || 'All Genres'
    : 'All Genres';

  return (
    <div className="container" style={{ marginTop: '40px', marginBottom: '40px' }}>
      <h2 className="section-title">
         {searchTerm ? `Results for "${searchTerm}"` : "PopCorn Database"}
      </h2>
      
      {/* Genre Filter Dropdown (Hidden during text search) */}
      {!searchTerm && (
        <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div className="custom-select-container">
            
            {/* The Clickable Button */}
            <div 
              className="custom-select-trigger"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span>{selectedGenreName}</span>
              <span style={{ 
                color: '#f5c518', 
                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                transition: 'transform 0.3s ease' 
              }}>▼</span>
            </div>

            {/* The Pop-Up Options Menu */}
            {isDropdownOpen && (
              <div className="custom-select-options">
                
                <div 
                  className="custom-option"
                  onClick={() => {
                    setSelectedGenre('');
                    setPage(0);
                    setMovies([]);
                    setIsDropdownOpen(false);
                  }}
                >
                  All Genres
                </div>

                {genres.map(genre => (
                  <div 
                    key={genre.id} 
                    className="custom-option"
                    onClick={() => {
                      setSelectedGenre(genre.id);
                      setPage(0);
                      setMovies([]);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {genre.name}
                  </div>
                ))}
              </div>
            )}

            

          </div>

            <div className="filter-controls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
             
             {/* Sort Dropdown - CHANGED: Added Default option and reset logic */}
             <select 
                value={sortBy} 
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(0);
                  setMovies([]);
                }}
                style={{ padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}
             >
                <option value="default">Default</option>
                <option value="rating_desc">Highest Rated</option>
                <option value="rating_asc">Lowest Rated</option>
                <option value="year_desc">Newest First</option>
                <option value="year_asc">Oldest First</option>
             </select>

             {/* Min Rating Input */}
             <input 
                type="number" 
                placeholder="Min Rating (0-10)" 
                min="0" max="10" step="0.5"
                value={minRating || ''} 
                onChange={(e) => setMinRating(parseFloat(e.target.value) || 0)}
                style={{ width: '130px', padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}
             />

             {/* Year Range Inputs */}
             <input 
                type="number" 
                placeholder="From Year" 
                value={minYear} 
                onChange={(e) => setMinYear(e.target.value)}
                style={{ width: '100px', padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}
             />
             <input 
                type="number" 
                placeholder="To Year" 
                value={maxYear} 
                onChange={(e) => setMaxYear(e.target.value)}
                style={{ width: '100px', padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}
             />

             {/* CHANGED: Added Clear All Filters Button */}
             <button 
                onClick={() => {
                  setMinRating(0);
                  setMinYear('');
                  setMaxYear('');
                  setSortBy('default');
                  setSelectedGenre('');
                  setPage(0);
                  setMovies([]);
                }}
                style={{
                  padding: '8px 15px',
                  backgroundColor: 'transparent',
                  color: '#ffc107',
                  border: '1px solid #ffc107',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
             >
                Clear All Filters
             </button>
          </div>

        </div>
      )}

      {/* Show Loading Indicator for Search */}
      {loading && searchTerm && <p style={{color:'#ccc'}}>Searching database...</p>}

      <div className="movie-grid">
        {movies.map((movie) => {
          const imageUrl = movie.poster_path 
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
            : null;

          return (
            // Changed from <div> to <Link> so it goes to the details page
            <Link 
              to={`/movie/${movie.id}`} 
              key={movie.id} 
              className="movie-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="movie-poster-container" style={{ position: 'relative', minHeight: '300px', background: '#222' }}>
                {imageUrl ? (
                   <img src={imageUrl} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                ) : (
                   <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666'}}>No Image</div>
                )}
              </div>
              <div className="movie-info" style={{padding: '12px 5px'}}>
                 <h3 style={{fontSize: '1rem', margin: '0 0 5px 0', color: '#fff'}}>{movie.title}</h3>
                 <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc'}}>
                    <span>{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
                    <span style={{color: '#f5c518'}}>⭐ {movie.vote_average ? movie.vote_average.toFixed(1) : '?'}</span>
                 </div>
              </div>
            </Link>
          );
        })}
      </div>

      {!searchTerm && !loading && (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <button onClick={() => fetchMovies()} className="btn btn-primary">Load More Movies</button>
        </div>
      )}
    </div>
  );
};

export default MovieFeed;




// import React, { useEffect, useState } from 'react';
// import { supabase } from '../supabaseClient'; 
// import { Link } from 'react-router-dom'; // Import Link so clicking works

// const MovieFeed = ({ searchTerm }) => {
//   const [movies, setMovies] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [page, setPage] = useState(0); 
//   const ITEMS_PER_PAGE = 20;

//   // adding later
//   const [genres, setGenres] = useState([]);
//   const [selectedGenre, setSelectedGenre] = useState('');
  
//   // ---> ADDED: State to manage the custom dropdown menu <---
//   const [isDropdownOpen, setIsDropdownOpen] = useState(false);

//   const [minRating, setMinRating] = useState(0);
//   const [minYear, setMinYear] = useState('');
//   const [maxYear, setMaxYear] = useState('');
//   const [sortBy, setSortBy] = useState('default');

//   // Fetch genres exactly once when the component loads
//   useEffect(() => {
//     async function fetchGenres() {
//       const { data, error } = await supabase
//         .from('genres')
//         .select('*')
//         .order('name');
      
//       if (!error && data) {
//         setGenres(data);
//       }
//     }
//     fetchGenres();
//   }, []);

//   // eita diye wait koray new page ashar agei, naile search 1 ta page e check kore stuck hoye jay
//   useEffect(() => {
//     const timer = setTimeout(() => {
//         // abar 0 page e back
//         fetchMovies(0, true);
//     }, 500); // 500 ms delay kore search er jonno, instant hole cholena

//     // 500 ms er moddhe search change korle ager searching clear kore fele
//     return () => clearTimeout(timer);
    
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [searchTerm, selectedGenre, minRating, minYear, maxYear, sortBy]); // Added selectedGenre here so it triggers a re-fetch


//   async function fetchMovies(pageNumberOverride = null, isSearchReset = false) {
//     setLoading(true);
    
//     const currentPage = pageNumberOverride !== null ? pageNumberOverride : page;
//     const from = currentPage * ITEMS_PER_PAGE;
//     const to = from + ITEMS_PER_PAGE - 1;

//     let query;

//     // FIX: Only use the inner join if a specific genre is actually selected from the dropdown
//     if (selectedGenre) {
//        query = supabase.from('movies')
//                        .select('*, movie_genres!inner(genre_id)')
//                        .eq('movie_genres.genre_id', selectedGenre);
//     } else {
//        // If "All Genres" is selected, just get the normal movies
//        query = supabase.from('movies').select('*');
//     }

//     // Apply the search term if the user is typing
//     if(searchTerm) {
//        query = query.ilike('title', `%${searchTerm}%`);
//     } 

//     // rating er jonno filter add kori

//     if(minRating>0){
//       query = query.gte('vote_average', minRating);
//     }

//     //year er jonno
//     // weird syntax string interpolation er jonno, year month date ei 

//     // tomake mone porbe 
//     // jokhoni akash venge borsha kade...
//     if(minYear){
//       query =   query.gte('release_date', `${minYear}-01-01`);
//     }

//     if(maxYear){
//       query =   query.gte('release_date', `${maxYear}-12-31`);
//     }

//     if(sortBy !== 'default'){if (sortBy === 'rating_desc') {
//         query = query.order('vote_average', { ascending: false });
//     } else if (sortBy === 'rating_asc') {
//         query = query.order('vote_average', { ascending: true });
//     } else if (sortBy === 'year_desc') {
//         query = query.order('release_date', { ascending: false }); // Newest first
//     } else if (sortBy === 'year_asc') {
//         query = query.order('release_date', { ascending: true }); // Oldest first
//     }}else{
//       query=query.order('id', {ascending:true});
//     }


    
   
//     query = query.range(from, to);

//     const { data, error } = await query;

//     if (error) {
//       console.error("Error fetching data:", error);
//     } else {
//       setMovies((prevMovies) => {
//         if (isSearchReset) {
//             return data;
//         }

//         const existingIds = new Set(prevMovies.map(m => m.id));
//         const uniqueNewMovies = data.filter(movie => !existingIds.has(movie.id));
//         return [...prevMovies, ...uniqueNewMovies];
//       });

//       if (data.length > 0) {
//           setPage(currentPage + 1);
//       }
//     }
//     setLoading(false);
//   }

//   // async function fetchMovies(pageNumberOverride = null, isSearchReset = false) {
//   //   // Note: removed immediate return logic so search can override loading state
//   //   setLoading(true);
    
//   //   const currentPage = pageNumberOverride !== null ? pageNumberOverride : page;
//   //   const from = currentPage * ITEMS_PER_PAGE;
//   //   const to = from + ITEMS_PER_PAGE - 1;

//   //   // We use inner join here to connect the movies to the junction table
//   //   let query = supabase.from('movies').select('*, movie_genres!inner(genre_id)');

//   //   if(searchTerm) {
//   //     // shalar backtick er jaygay '' diye kothin mara khailam
//   //      query = query.ilike('title', `%${searchTerm}%`);
//   //   } else if (selectedGenre) {
//   //      // Filter by the selected genre ID
//   //      query = query.eq('movie_genres.genre_id', selectedGenre).range(from, to);
//   //   } else {
//   //      query = query.range(from, to);
//   //   }

//   //   const { data, error } = await query;

//   //   if (error) {
//   //     console.error("Error fetching data:", error);
//   //   } else {
//   //     setMovies((prevMovies) => {
//   //       if (isSearchReset) {
//   //           return data;
//   //       }

//   //       const existingIds = new Set(prevMovies.map(m => m.id));
//   //       const uniqueNewMovies = data.filter(movie => !existingIds.has(movie.id));
//   //       return [...prevMovies, ...uniqueNewMovies];
//   //     });

//   //     if (data.length > 0) {
//   //         setPage(currentPage + 1);
//   //     }
//   //   }
//   //   setLoading(false);
//   // }

//   // ---> ADDED: Find the name of the currently selected genre to display on the button <---
//   const selectedGenreName = selectedGenre 
//     ? genres.find(g => g.id.toString() === selectedGenre.toString())?.name || 'All Genres'
//     : 'All Genres';

//   return (
//     <div className="container" style={{ marginTop: '40px', marginBottom: '40px' }}>
//       <h2 className="section-title">
//          {searchTerm ? `Results for "${searchTerm}"` : "PopCorn Database"}
//       </h2>
      
//       {/* Genre Filter Dropdown (Hidden during text search) */}
//       {!searchTerm && (
//         <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'center' }}>
//           <div className="custom-select-container">
            
//             {/* The Clickable Button */}
//             <div 
//               className="custom-select-trigger"
//               onClick={() => setIsDropdownOpen(!isDropdownOpen)}
//             >
//               <span>{selectedGenreName}</span>
//               <span style={{ 
//                 color: '#f5c518', 
//                 transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
//                 transition: 'transform 0.3s ease' 
//               }}>▼</span>
//             </div>

//             {/* The Pop-Up Options Menu */}
//             {isDropdownOpen && (
//               <div className="custom-select-options">
                
//                 <div 
//                   className="custom-option"
//                   onClick={() => {
//                     setSelectedGenre('');
//                     setPage(0);
//                     setMovies([]);
//                     setIsDropdownOpen(false);
//                   }}
//                 >
//                   All Genres
//                 </div>

//                 {genres.map(genre => (
//                   <div 
//                     key={genre.id} 
//                     className="custom-option"
//                     onClick={() => {
//                       setSelectedGenre(genre.id);
//                       setPage(0);
//                       setMovies([]);
//                       setIsDropdownOpen(false);
//                     }}
//                   >
//                     {genre.name}
//                   </div>
//                 ))}
//               </div>
//             )}

            

//           </div>

//             <div className="filter-controls" style={{ display: 'flex', gap: '10px' }}>
             
//              {/* Sort Dropdown */}
//              <select 
//                 value={sortBy} 
//                 onChange={(e) => setSortBy(e.target.value)}
//                 style={{ padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}
//              >
//                 <option value="rating_desc">Highest Rated</option>
//                 <option value="rating_asc">Lowest Rated</option>
//                 <option value="year_desc">Newest First</option>
//                 <option value="year_asc">Oldest First</option>
//              </select>

//              {/* Min Rating Input */}
//              <input 
//                 type="number" 
//                 placeholder="Min Rating (0-10)" 
//                 min="0" max="10" step="0.5"
//                 value={minRating || ''} 
//                 onChange={(e) => setMinRating(parseFloat(e.target.value) || 0)}
//                 style={{ width: '130px', padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}
//              />

//              {/* Year Range Inputs */}
//              <input 
//                 type="number" 
//                 placeholder="From Year" 
//                 value={minYear} 
//                 onChange={(e) => setMinYear(e.target.value)}
//                 style={{ width: '100px', padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}
//              />
//              <input 
//                 type="number" 
//                 placeholder="To Year" 
//                 value={maxYear} 
//                 onChange={(e) => setMaxYear(e.target.value)}
//                 style={{ width: '100px', padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}
//              />
//           </div>

//         </div>
//       )}

//       {/* Show Loading Indicator for Search */}
//       {loading && searchTerm && <p style={{color:'#ccc'}}>Searching database...</p>}

//       <div className="movie-grid">
//         {movies.map((movie) => {
//           const imageUrl = movie.poster_path 
//             ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
//             : null;

//           return (
//             // Changed from <div> to <Link> so it goes to the details page
//             <Link 
//               to={`/movie/${movie.id}`} 
//               key={movie.id} 
//               className="movie-card"
//               style={{ textDecoration: 'none', color: 'inherit' }}
//             >
//               <div className="movie-poster-container" style={{ position: 'relative', minHeight: '300px', background: '#222' }}>
//                 {imageUrl ? (
//                    <img src={imageUrl} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
//                 ) : (
//                    <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666'}}>No Image</div>
//                 )}
//               </div>
//               <div className="movie-info" style={{padding: '12px 5px'}}>
//                  <h3 style={{fontSize: '1rem', margin: '0 0 5px 0', color: '#fff'}}>{movie.title}</h3>
//                  <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc'}}>
//                     <span>{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
//                     <span style={{color: '#f5c518'}}>⭐ {movie.vote_average ? movie.vote_average.toFixed(1) : '?'}</span>
//                  </div>
//               </div>
//             </Link>
//           );
//         })}
//       </div>

//       {!searchTerm && !loading && (
//         <div style={{ textAlign: 'center', marginTop: '40px' }}>
//             <button onClick={() => fetchMovies()} className="btn btn-primary">Load More Movies</button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default MovieFeed;




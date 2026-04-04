import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Link } from 'react-router-dom';
import './CrewsPage.css';

function CrewsPage() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [department, setDepartment] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const ITEMS_PER_PAGE = 24;
  const debounceRef = useRef(null);
  const pageRef = useRef(0);

  const fetchPeople = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const pageNum = reset ? 0 : pageRef.current;
      const from = pageNum * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('people')
        .select('id, name, gender, popularity, profile_path, known_for_department, adult');

      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      if (department) {
        query = query.eq('known_for_department', department);
      }

      // Tie breaker for consistent pagination
      query = query.order('popularity', { ascending: false }).order('id', { ascending: true }).range(from, to);

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching crew:', fetchError);
        setError(`Failed to fetch crew data: ${fetchError.message}. This might be a Row Level Security (RLS) issue on your Supabase "people" table.`);
      } else {
        console.log(`Fetched ${(data || []).length} crew members (page ${pageNum})`);
        if (reset) {
          setPeople(data || []);
          pageRef.current = 1;
        } else {
          setPeople(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = (data || []).filter(p => !existingIds.has(p.id));
            return [...prev, ...newItems];
          });
          pageRef.current = pageNum + 1;
        }
        setHasMore((data || []).length === ITEMS_PER_PAGE);
      }
    } catch (err) {
      console.error('Crew fetch error:', err);
      setError('Failed to connect to database.');
    }
    setLoading(false);
  }, [searchTerm, department]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPeople(true);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, department, fetchPeople]);

  const loadMore = () => {
    fetchPeople(false);
  };

  return (
    <div className="crews-page">
      <div className="crews-header">
        <h1 className="crews-title">🎭 Film Crews & Artists</h1>
        <p className="crews-subtitle">Discover actors, directors, writers, and more behind your favorite movies</p>
      </div>

      <div className="crews-controls">
        <div className="crews-search">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="crews-filter">
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All Departments</option>
            <option value="Acting">Acting</option>
            <option value="Directing">Directing</option>
            <option value="Writing">Writing</option>
            <option value="Production">Production</option>
            <option value="Camera">Camera</option>
            <option value="Editing">Editing</option>
            <option value="Art">Art</option>
            <option value="Sound">Sound</option>
            <option value="Crew">Crew</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="crews-error">
          <span>⚠️</span>
          <div>
            <strong>Could not load crew data</strong>
            <p>{error}</p>
            <p style={{ marginTop: '8px', fontSize: '0.85rem', opacity: 0.7 }}>
              💡 <strong>Fix:</strong> Go to Supabase → Table Editor → "people" → RLS Policies → 
              Add a policy that allows <code>SELECT</code> for <code>anon</code> role, or disable RLS on the table.
            </p>
          </div>
        </div>
      )}

      {loading && people.length === 0 && !error ? (
        <div className="crews-loading">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="crew-card-skeleton" />
          ))}
        </div>
      ) : people.length === 0 && !error ? (
        <div className="crews-empty">
          <span style={{ fontSize: '3rem' }}>🔎</span>
          <h3>No crew members found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="crews-grid">
            {people.map(person => {
              const photoUrl = person.profile_path
                ? (person.profile_path.startsWith('http')
                  ? person.profile_path
                  : `https://image.tmdb.org/t/p/w185${person.profile_path}`)
                : null;

              return (
                <Link to={`/person/${person.id}`} key={person.id} className="crew-card" style={{textDecoration: 'none', color: 'inherit'}}>
                  <div className="crew-photo">
                    {photoUrl ? (
                      <img src={photoUrl} alt={person.name} />
                    ) : (
                      <div className="crew-no-photo">
                        {person.gender === 1 ? '👩' : person.gender === 2 ? '👨' : '🧑'}
                      </div>
                    )}
                    {person.popularity && (
                      <div className="crew-popularity">
                        🔥 {Math.round(person.popularity)}
                      </div>
                    )}
                  </div>
                  <div className="crew-info">
                    <h3 className="crew-name">{person.name}</h3>
                    {person.known_for_department && (
                      <span className="crew-department">{person.known_for_department}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {hasMore && !loading && (
            <div className="crews-load-more">
              <button onClick={loadMore} className="btn btn-primary">
                Load More
              </button>
            </div>
          )}

          {loading && people.length > 0 && (
            <div className="crews-load-more">
              <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading more...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CrewsPage;

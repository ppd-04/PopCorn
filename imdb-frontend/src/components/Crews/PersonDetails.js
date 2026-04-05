import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import './PersonDetails.css';

const API_BASE = 'http://localhost:5000/api';

const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

const PersonDetails = () => {
    const { id } = useParams();
    const [person, setPerson] = useState(null);
    const [movies, setMovies] = useState([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const lastIntendedState = useRef(null);

    const fetchPersonAndMovies = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [personRes, moviesRes] = await Promise.all([
                fetch(`${API_BASE}/person/${id}`, { headers: authHeaders() }),
                fetch(`${API_BASE}/person/${id}/movies`)
            ]);
            if (!personRes.ok) throw new Error('Person not found');
            const personData = await personRes.json();
            setPerson(personData);
            // Only set initial state if user hasn't toggled it manually yet
            if (lastIntendedState.current === null) {
                setIsFollowing(personData.is_following === true);
            }
            setMovies(await moviesRes.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchPersonAndMovies();
        window.scrollTo(0, 0);
    }, [fetchPersonAndMovies]);

    const toggleFollow = async () => {
        if (followLoading) return;

        // eta ami konovabie bujhi nai ki hoise, onekkhon dhore hoi nai
        const nextState = !isFollowing;
        setIsFollowing(nextState);
        lastIntendedState.current = nextState;

        setFollowLoading(true);
        try {
            const res = await fetch(`${API_BASE}/people/${id}/follow`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    person_name: person.name,
                    person_role: person.known_for_department,
                    profile_path: person.profile_path
                })
            });

            if (!res.ok && res.status === 401) {
                alert("Please log in to follow artists.");
                setIsFollowing(!nextState); // Revert only on auth error
                lastIntendedState.current = !nextState;
            }

        } catch (err) {
            console.error('Failed to toggle follow status:', err);
        } finally {
            setFollowLoading(false);
        }
    };

    if (loading) return <div className="loading-spinner"><h2>Loading Profile...</h2></div>;
    if (error) return <div className="loading-spinner" style={{ color: 'red' }}><h2>Error: {error}</h2></div>;
    if (!person) return null;

    const photoUrl = person.profile_path
        ? (person.profile_path.startsWith('http') ? person.profile_path : `https://image.tmdb.org/t/p/w500${person.profile_path}`)
        : null;

    return (
        <div className="person-details-page">
            <div className="person-header">
                <div className="person-poster">
                    {photoUrl ? (
                        <img src={photoUrl} alt={person.name} />
                    ) : (
                        <div className="person-no-photo">
                            {person.gender === 1 ? '👩' : person.gender === 2 ? '👨' : '🧑'}
                        </div>
                    )}
                </div>
                <div className="person-info">
                    <h1 className="person-title">{person.name}</h1>
                    {person.known_for_department && (
                        <div className="person-tagline">
                            <span className="person-department-badge">{person.known_for_department}</span>
                        </div>
                    )}

                    <div className="person-meta">
                        {person.popularity && (
                            <div className="meta-item">
                                <span className="meta-label">Popularity</span>
                                <span className="meta-value">🔥 {Math.round(person.popularity)}</span>
                            </div>
                        )}
                        {person.birthday && (
                            <div className="meta-item">
                                <span className="meta-label">Born</span>
                                <span className="meta-value">{new Date(person.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                        )}
                        {person.place_of_birth && (
                            <div className="meta-item">
                                <span className="meta-label">Birthplace</span>
                                <span className="meta-value">{person.place_of_birth}</span>
                            </div>
                        )}
                    </div>

                    <button
                        className={`follow-btn ${isFollowing ? 'following' : ''}`}
                        onClick={toggleFollow}
                        disabled={followLoading}
                        style={{ opacity: followLoading ? 0.6 : 1, cursor: followLoading ? 'not-allowed' : 'pointer' }}
                    >
                        {followLoading ? '...' : (isFollowing ? 'Unfollow' : '+ Follow')}
                    </button>
                </div>
            </div>

            {person.biography && (
                <div className="biography-section">
                    <h2 className="section-title">Biography</h2>
                    <p className="biography-text">
                        {person.biography || "No biography available."}
                    </p>
                </div>
            )}

            <div className="filmography-section">
                <h2 className="section-title">Filmography ({movies.length})</h2>
                {movies.length === 0 ? (
                    <p style={{ color: '#888' }}>No movies found for this person.</p>
                ) : (
                    <div className="movies-grid">
                        {movies.map(movie => (
                            <Link to={`/movie/${movie.id || movie.movie_id}`} key={movie.id || movie.movie_id} className="movie-card">
                                <div className="movie-poster">
                                    {movie.poster_path ? (
                                        <img src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`} alt={movie.title} />
                                    ) : (
                                        <div className="person-no-photo" style={{ fontSize: '3rem' }}>🎬</div>
                                    )}
                                </div>
                                <div className="movie-info">
                                    <h3 className="movie-title">{movie.title}</h3>
                                    {movie.release_date && <span className="movie-year">{movie.release_date.split('-')[0]}</span>}
                                    {movie.character && <span className="movie-character">{movie.character}</span>}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonDetails;

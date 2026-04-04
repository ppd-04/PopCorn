import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function PeopleSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const fetchUsers = async () => {
            setLoading(true);
            try {
                const response = await fetch(`http://localhost:5000/api/users/search?q=${encodeURIComponent(query)}`);
                if (response.ok) {
                    const data = await response.json();
                    setResults(data);
                }
            } catch (err) {
                console.error("Failed to search users", err);
            } finally {
                setLoading(false);
            }
        };

        // simple debounce
        const timerId = setTimeout(() => {
            fetchUsers();
        }, 300);

        return () => clearTimeout(timerId);
    }, [query]);

    return (
        <div style={{ padding: '80px 20px', maxWidth: '600px', margin: '0 auto', color: 'var(--text-color)' }}>
            <h1 style={{ marginBottom: '20px' }}>🔍 Find People</h1>
            <input 
                type="text" 
                placeholder="Search by username or name..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                    width: '100%',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--text-color)',
                    fontSize: '16px',
                    marginBottom: '20px'
                }}
            />
            
            {loading && <p>Loading...</p>}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {results.length > 0 ? (
                    results.map(user => (
                        <Link 
                            to={`/user/${user.user_id}`} 
                            key={user.user_id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '15px',
                                backgroundColor: 'var(--card-bg)',
                                borderRadius: '12px',
                                textDecoration: 'none',
                                color: 'inherit',
                                border: '1px solid var(--border-color)'
                            }}
                        >
                            {user.profile_picture ? (
                                <img 
                                    src={user.profile_picture} 
                                    alt={user.username} 
                                    style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px' }} 
                                />
                            ) : (
                                <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', fontSize: '20px' }}>
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <h3 style={{ margin: 0 }}>{user.full_name || user.username}</h3>
                                <span style={{ opacity: 0.7 }}>@{user.username}</span>
                            </div>
                        </Link>
                    ))
                ) : (
                    query && !loading && <p>No users found matching "{query}".</p>
                )}
            </div>
        </div>
    );
}

export default PeopleSearch;

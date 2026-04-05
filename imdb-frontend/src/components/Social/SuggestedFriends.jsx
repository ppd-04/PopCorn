import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:5000/api';

function authHeaders() {
    const token = localStorage.getItem('token');
    return token
        ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
}

const TIER_CONFIG = {
    mutual: { icon: '🤝', color: '#f5c518', label: 'Mutual' },
    genre:  { icon: '🎭', color: '#a78bfa', label: 'Genre'  },
    taste:  { icon: '🎬', color: '#34d399', label: 'Taste'  },
};

function SuggestedFriends({ user }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [sentRequests, setSentRequests] = useState(new Set());
    const navigate = useNavigate();

    const fetchSuggestions = useCallback(async () => {
        if (!user) { setLoading(false); return; }
        try {
            const res = await fetch(`${API_BASE}/social/suggested-friends`, { headers: authHeaders() });
            if (res.ok) setSuggestions(await res.json());
        } catch (e) {
            console.error('Suggested friends fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

    const sendRequest = async (targetId) => {
        try {
            const res = await fetch(`${API_BASE}/friends/request/${targetId}`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (res.ok) {
                setSentRequests(prev => new Set(prev).add(targetId));
            }
        } catch (e) {
            console.error('Friend request error:', e);
        }
    };

    if (!user) {
        return (
            <div className="sf-empty-state">
                <div className="sf-empty-icon">🔍</div>
                <p>Log in to discover people who share your taste in movies.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="sf-list">
                {[1, 2, 3].map(i => (
                    <div key={i} className="sf-skeleton">
                        <div className="sf-skeleton-avatar shimmer" />
                        <div className="sf-skeleton-body">
                            <div className="sf-skeleton-line shimmer" style={{ width: '60%' }} />
                            <div className="sf-skeleton-line shimmer" style={{ width: '40%', height: '10px', marginTop: '6px' }} />
                        </div>
                        <div className="sf-skeleton-btn shimmer" />
                    </div>
                ))}
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="sf-empty-state">
                <div className="sf-empty-icon">🎥</div>
                <p>No suggestions yet. Rate more movies to unlock personalized matches!</p>
            </div>
        );
    }

    return (
        <div className="sf-list">
            {suggestions.map((s, idx) => {
                const cfg   = TIER_CONFIG[s.tier] || TIER_CONFIG.taste;
                const sent  = sentRequests.has(s.user_id);
                const initial = (s.full_name || s.username || '?').charAt(0).toUpperCase();

                return (
                    <div
                        key={s.user_id}
                        className="sf-card"
                        style={{ animationDelay: `${idx * 70}ms` }}
                    >
                        <div
                            className="sf-avatar"
                            onClick={() => navigate(`/user/${s.user_id}`)}
                            title={`View ${s.username}'s profile`}
                        >
                            {s.profile_picture
                                ? <img src={s.profile_picture} alt={s.username} />
                                : <span>{initial}</span>
                            }
                        </div>

                        <div className="sf-info" onClick={() => navigate(`/user/${s.user_id}`)}>
                            <div className="sf-name">{s.full_name || s.username}</div>
                            <div className="sf-username">@{s.username}</div>
                            {s.reason && (
                                <div className="sf-reason-badge" style={{ '--badge-color': cfg.color }}>
                                    <span>{cfg.icon}</span>
                                    <span>{s.reason}</span>
                                </div>
                            )}
                        </div>

                        <button
                            className={`sf-add-btn ${sent ? 'sent' : ''}`}
                            onClick={() => !sent && sendRequest(s.user_id)}
                            disabled={sent}
                            title={sent ? 'Request sent!' : 'Send friend request'}
                        >
                            {sent ? '✓' : '+'}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

export default SuggestedFriends;

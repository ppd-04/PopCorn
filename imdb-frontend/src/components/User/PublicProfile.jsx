import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function PublicProfile({ currentUser }) {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    const isOwnProfile = currentUser && currentUser.id === parseInt(id);

    useEffect(() => {
        const fetchProfile = async () => {
            if (isOwnProfile) {
                // If it's their own profile, just redirect to the real private profile page
                navigate('/profile');
                return;
            }

            try {
                const headers = {};
                const token = localStorage.getItem('token');
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const profRes = await fetch(`http://localhost:5000/api/users/${id}/profile`, { headers });
                if (profRes.ok) {
                    setProfile(await profRes.json());
                }

                const postRes = await fetch(`http://localhost:5000/api/users/${id}/posts`, { headers });
                if (postRes.ok) {
                    setPosts(await postRes.json());
                }
            } catch (err) {
                console.error("Failed to load profile", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [id, currentUser, navigate]);

    const handleFriendAction = async (action) => {
        if (!currentUser) {
            alert("Please log in to add friends.");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            
            let url = '';
            if (action === 'request') url = `http://localhost:5000/api/friends/request/${id}`;
            else if (action === 'accept') url = `http://localhost:5000/api/friends/accept/${id}`;
            else if (action === 'reject' || action === 'unfriend') url = `http://localhost:5000/api/friends/reject/${id}`;

            const res = await fetch(url, { method: 'POST', headers });
            
            if (res.ok) {
                // Update local state instead of full reload
                setProfile(prev => {
                    let newStatus = prev.friendStatus;
                    let newActionStatus = prev.actionUserId;
                    
                    if (action === 'request') {
                        newStatus = 'pending';
                        newActionStatus = currentUser.id;
                    } else if (action === 'accept') {
                        newStatus = 'accepted';
                    } else if (action === 'reject' || action === 'unfriend') {
                        newStatus = 'none';
                        newActionStatus = null;
                    }
                    return { ...prev, friendStatus: newStatus, actionUserId: newActionStatus };
                });
            } else {
                console.error("Action failed");
            }
        } catch (err) {
            console.error("Error performing action", err);
        }
    };

    if (loading) return <div style={{ padding: '100px', textAlign: 'center', color: 'white' }}>Loading Profile...</div>;
    if (!profile) return <div style={{ padding: '100px', textAlign: 'center', color: 'white' }}>User not found.</div>;

    // Determine button state
    let friendButton = null;
    if (currentUser) {
        if (profile.friendStatus === 'none') {
            friendButton = <button className="btn btn-primary" onClick={() => handleFriendAction('request')}>➕ Add Friend</button>;
        } else if (profile.friendStatus === 'pending') {
            if (profile.actionUserId === currentUser.id) {
                friendButton = <button className="btn" disabled style={{ opacity: 0.7 }}>⏳ Request Sent</button>;
            } else {
                friendButton = (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn btn-primary" onClick={() => handleFriendAction('accept')}>✅ Accept Request</button>
                        <button className="btn btn-secondary" onClick={() => handleFriendAction('reject')}>❌ Reject</button>
                    </div>
                );
            }
        } else if (profile.friendStatus === 'accepted') {
            friendButton = (
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn" disabled style={{ backgroundColor: '#28a745', color: 'white' }}>🤝 Friends</button>
                    <button className="btn btn-secondary" onClick={() => handleFriendAction('unfriend')} style={{ padding: '8px 12px', fontSize: '12px' }}>Unfriend</button>
                </div>
            );
        }
    }

    return (
        <div style={{ padding: '80px 20px', maxWidth: '800px', margin: '0 auto', color: 'var(--text-color)' }}>
            
            {/* Header / Profile Card */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '30px', 
                padding: '30px', 
                backgroundColor: 'var(--card-bg)', 
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                marginBottom: '40px' 
            }}>
                {profile.profile_picture ? (
                    <img 
                        src={profile.profile_picture} 
                        alt={profile.username} 
                        style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover' }} 
                    />
                ) : (
                    <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 'bold' }}>
                        {profile.username.charAt(0).toUpperCase()}
                    </div>
                )}
                
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: '0 0 5px 0' }}>{profile.full_name || profile.username}</h1>
                    <p style={{ margin: '0 0 20px 0', opacity: 0.7, fontSize: '18px' }}>@{profile.username}</p>
                    {friendButton}
                </div>
            </div>

            {/* Posts Section */}
            <h2>{profile.username}'s Posts</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                {posts.length > 0 ? (
                    posts.map(post => (
                        <div key={post.post_id} style={{ 
                            padding: '25px', 
                            backgroundColor: 'var(--card-bg)', 
                            borderRadius: '16px',
                            border: '1px solid var(--border-color)' 
                        }}>
                            <p style={{ margin: '0 0 15px 0', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{post.content}</p>
                            {post.image && (
                                <img src={post.image} alt="Post attachment" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '15px' }} />
                            )}
                            <div style={{ display: 'flex', gap: '15px', opacity: 0.7, fontSize: '14px' }}>
                                <span>{post.like_count} Likes</span>
                                <span>{post.comment_count} Comments</span>
                                <span>•</span>
                                <span>{new Date(post.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <p style={{ opacity: 0.6 }}>No posts yet.</p>
                )}
            </div>

        </div>
    );
}

export default PublicProfile;

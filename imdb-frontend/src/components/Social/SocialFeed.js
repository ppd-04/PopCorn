import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderWithMentions, getFirstMention } from '../../utils/MentionsUtil';
import MentionInput from './MentionInput';
import CinemaBackground from './CinemaBackground';
import { supabase } from '../../supabaseClient';
import SuggestedFriends from './SuggestedFriends';
import './Social.css';

const API_BASE = 'http://localhost:5000/api';

const GENRE_COLORS = [
    { bg: 'rgba(245,197,24,0.12)', border: 'rgba(245,197,24,0.4)', text: '#f5c518' },
    { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.4)', text: '#a78bfa' },
    { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.4)', text: '#34d399' },
    { bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.4)', text: '#fb7185' },
    { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.4)', text: '#60a5fa' },
    { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)', text: '#fbbf24' },
];

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function authHeaders() {
    const token = localStorage.getItem('token');
    return token
        ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
}

function SocialFeed({ user }) {
    const [posts, setPosts]                     = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [discussions, setDiscussions]         = useState([]);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [userStats, setUserStats]             = useState(null);
    const [userInterests, setUserInterests]     = useState([]);
    const [communityStats, setCommunityStats]   = useState(null);
    const [activePoster, setActivePoster]       = useState(null);

    const navigate = useNavigate();

    const updateBackground = useCallback(async (content) => {
        const mention = getFirstMention(content);
        if (mention) {
            try {
                const res = await fetch(`${API_BASE}/movies/mention/resolve?id=${mention.id}&type=${mention.type}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.poster_path) setActivePoster(data.poster_path);
                }
            } catch (err) { console.error("BG update error", err); }
        }
    }, []);

    const fetchPosts = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/posts`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setPosts(data);
                
                for (let p of data) {
                    const m = getFirstMention(p.content);
                    if (m) {
                        updateBackground(p.content);
                        break;
                    }
                }
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [updateBackground]);

    const fetchDiscussions = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/discussions/feed`, { headers: authHeaders() });
            if (res.ok) setDiscussions(await res.json());
        } catch (err) { }
    }, []);

    const fetchUserStats = useCallback(async () => {
        if (!user) return;
        try {
            const res = await fetch(`${API_BASE}/profile/stats`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setUserStats(data);
                setUserInterests(data.interests || []);
            }
        } catch (err) { }
    }, [user]);

    const fetchCommunityStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/social/community-stats`);
            if (res.ok) setCommunityStats(await res.json());
        } catch (err) { }
    }, []);

    useEffect(() => {
        fetchPosts();
        fetchCommunityStats();
        if (user) { fetchDiscussions(); fetchUserStats(); }
    }, [fetchPosts, fetchDiscussions, fetchUserStats, fetchCommunityStats, user]);

    const handlePostCreated = (p) => {
        setPosts([p, ...posts]);
        updateBackground(p.content);
    };
    const handlePostUpdated = (upd)        => setPosts(posts.map(p => p.post_id === upd.post_id ? { ...p, ...upd } : p));
    const handlePostDeleted = (id)         => setPosts(posts.filter(p => p.post_id !== id));
    const handleLikeToggled = (id, l, c)  => setPosts(posts.map(p => p.post_id === id ? { ...p, liked_by_me: l, like_count: c } : p));

    const userInitial = user ? (user.full_name || user.username || '?').charAt(0).toUpperCase() : '?';

    return (
        <div className="social-page layout-3-col">
            <CinemaBackground posterPath={activePoster} />
            <div className="social-container-main">

                <div className="social-left-col">

                    {/* User Profile Card */}
                    {user && (
                        <div className="profile-card">
                            <div className="profile-card-avatar" onClick={() => navigate('/profile')}>
                                {user.profile_picture ? <img src={user.profile_picture} alt={user.username} /> : userInitial}
                            </div>
                            <div className="profile-card-name" onClick={() => navigate('/profile')}>
                                {user.full_name || user.username}
                            </div>
                            <div className="profile-card-handle">@{user.username}</div>

                            {userStats && (
                                <div className="profile-stats-strip">
                                    <div className="profile-stat" onClick={() => navigate('/profile')}>
                                        <div className="profile-stat-value">{userStats.movies_watched ?? 0}</div>
                                        <div className="profile-stat-label">Watched</div>
                                    </div>
                                    <div className="profile-stat" onClick={() => navigate('/profile')}>
                                        <div className="profile-stat-value">{userStats.total_ratings ?? 0}</div>
                                        <div className="profile-stat-label">Rated</div>
                                    </div>
                                    <div className="profile-stat" onClick={() => navigate('/profile')}>
                                        <div className="profile-stat-value">{userStats.favourites_count ?? 0}</div>
                                        <div className="profile-stat-label">Favs</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {user && (
                        <div className="genre-mood-section">
                            <h3>🎭 Your Genres</h3>
                            <div className="genre-pill-grid">
                                {userInterests.length > 0 ? userInterests.map((g, i) => {
                                    const c = GENRE_COLORS[i % GENRE_COLORS.length];
                                    return (
                                        <span key={g.genre_id} className="genre-pill"
                                            style={{ background: c.bg, borderColor: c.border, color: c.text, animationDelay: `${i * 60}ms` }}>
                                            {g.genre_name}
                                        </span>
                                    );
                                }) : (
                                    <span className="genre-pill-empty">Set genre interests in your profile!</span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="social-sidebar-card">
                        <h3>💬 Discussions</h3>
                        <p style={{ fontSize: '12px', opacity: 0.45, marginBottom: '14px', lineHeight: 1.5 }}>
                            Join global spaces or create your own invite-only rooms.
                        </p>
                        {user ? (
                            <button className="btn-full-width" onClick={() => setShowCreateGroup(true)}>
                                ➕ Create Discussion Room
                            </button>
                        ) : (
                            <p style={{ fontSize: '13px', color: '#f5c518', marginBottom: '14px' }}>Log in to join discussions.</p>
                        )}
                        <div className="discussion-list">
                            {discussions.map(d => (
                                <div key={d.id} className="discussion-list-item" onClick={() => navigate(`/social/discussion/${d.id}`)}>
                                    {d.poster_path
                                        ? <img src={`https://image.tmdb.org/t/p/w200${d.poster_path}`} alt="poster" className="discussion-thumb" />
                                        : <div className="discussion-thumb placeholder">🎬</div>
                                    }
                                    <div className="discussion-info">
                                        <h4>{d.title}</h4>
                                        <span>{d.access_level.toUpperCase()} • {d.movie_title || 'General'}</span>
                                    </div>
                                </div>
                            ))}
                            {discussions.length === 0 && user && (
                                <p style={{ opacity: 0.4, fontSize: '12px', textAlign: 'center', padding: '10px 0' }}>No active discussions yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="social-mid-col">
                    <div className="social-header">
                        <h1>🍿 The PopCorn Feed</h1>
                        <p>Share your thoughts &amp; connect with fellow cinephiles</p>
                    </div>

                    {user
                        ? <CreatePost user={user} onPostCreated={handlePostCreated} />
                        : <div className="social-login-prompt"><span>Log in</span> to create posts, like, and comment!</div>
                    }

                    {loading ? (
                        <div className="social-loading"><div className="spinner" /><p>Loading feed…</p></div>
                    ) : posts.length === 0 ? (
                        <div className="social-empty-state">
                            <div className="empty-icon">🎬</div>
                            <h3 style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>No posts yet — be the first!</h3>
                        </div>
                    ) : (
                        posts.map(post => (
                            <PostCard
                                key={post.post_id}
                                post={post}
                                user={user}
                                onPostUpdated={handlePostUpdated}
                                onPostDeleted={handlePostDeleted}
                                onLikeToggled={handleLikeToggled}
                                navigate={navigate}
                            />
                        ))
                    )}
                </div>

                <div className="social-right-col">

                    <div className="social-sidebar-card">
                        <h3>✨ Suggested Friends</h3>
                        <SuggestedFriends user={user} />
                        {user && (
                            <button className="btn-secondary-full" onClick={() => navigate('/people')} style={{ marginTop: '12px' }}>
                                🔍 Search All People
                            </button>
                        )}
                    </div>

                    {discussions.length > 0 && (
                        <div className="social-sidebar-card">
                            <h3>🔥 Active Rooms</h3>
                            {discussions.slice(0, 3).map(d => (
                                <div key={d.id} className="discussion-list-item" onClick={() => navigate(`/social/discussion/${d.id}`)} style={{ padding: '8px' }}>
                                    {d.poster_path
                                        ? <img src={`https://image.tmdb.org/t/p/w92${d.poster_path}`} alt="poster" className="discussion-thumb" style={{ width: '30px', height: '44px' }} />
                                        : <div className="discussion-thumb placeholder" style={{ width: '30px', height: '44px', fontSize: '14px' }}>🎬</div>
                                    }
                                    <div className="discussion-info">
                                        <h4 style={{ fontSize: '12px' }}>{d.title}</h4>
                                        <span>{d.movie_title || 'General'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {communityStats && (
                        <div className="social-sidebar-card">
                            <h3>📊 Community</h3>
                            <div className="community-stats-grid">
                                <div className="community-stat">
                                    <div className="community-stat-value">
                                        {communityStats.total_posts >= 1000
                                            ? `${(communityStats.total_posts / 1000).toFixed(1)}k`
                                            : communityStats.total_posts}
                                    </div>
                                    <div className="community-stat-label">Posts</div>
                                </div>
                                <div className="community-stat">
                                    <div className="community-stat-value">
                                        {communityStats.total_users >= 1000
                                            ? `${(communityStats.total_users / 1000).toFixed(1)}k`
                                            : communityStats.total_users}
                                    </div>
                                    <div className="community-stat-label">Members</div>
                                </div>
                                <div className="community-stat">
                                    <div className="community-stat-value">{communityStats.active_today}</div>
                                    <div className="community-stat-label">Active today</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showCreateGroup && (
                <CreateDiscussionModal
                    user={user}
                    onClose={() => setShowCreateGroup(false)}
                    onCreated={fetchDiscussions}
                    navigate={navigate}
                />
            )}
        </div>
    );
}

function CreatePost({ user, onPostCreated }) {
    const [content, setContent]           = useState('');
    const [image, setImage]               = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileRef = useRef(null);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) return alert('Max 10 MB.');
        const reader = new FileReader();
        reader.onloadend = () => { setImage(reader.result); setImagePreview(reader.result); };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!content.trim() && !image) return;
        try {
            const res = await fetch(`${API_BASE}/posts`, {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ content, imageBase64: image }),
            });
            if (res.ok) { onPostCreated(await res.json()); setContent(''); setImage(null); setImagePreview(null); }
        } catch (e) { console.error(e); }
    };

    return (
        <div className="create-post-card">
            <div className="create-post-top">
                <div className="create-post-avatar">
                    {user.profile_picture ? <img src={user.profile_picture} alt="Avatar" /> : user.username.charAt(0).toUpperCase()}
                </div>
                <MentionInput
                    className="create-post-textarea"
                    placeholder="Share a thought… Tag movies with @"
                    value={content}
                    onChange={v => setContent(v)}
                />
            </div>
            {imagePreview && (
                <div className="create-post-image-preview">
                    <img src={imagePreview} alt="Preview" />
                    <button className="remove-image-btn" onClick={() => { setImage(null); setImagePreview(null); }}>✕</button>
                </div>
            )}
            <div className="create-post-actions">
                <button className="action-btn-icon" onClick={() => fileRef.current.click()}>📷 Attach Photo</button>
                <input type="file" accept="image/*" ref={fileRef} className="social-file-input-hidden" onChange={handleImageChange} />
                <button className="post-submit-btn" disabled={!content.trim() && !image} onClick={handleSubmit}>Post</button>
            </div>
        </div>
    );
}

function PostCard({ post, user, onPostUpdated, onPostDeleted, onLikeToggled, navigate }) {
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments]         = useState([]);
    const [newComment, setNewComment]     = useState('');
    
    const [replyToId, setReplyToId]       = useState(null);
    const [replyContent, setReplyContent] = useState('');

    const [showMenu, setShowMenu]         = useState(false);
    const [editing, setEditing]           = useState(false);
    const [editContent, setEditContent]   = useState(post.content);
    const menuRef = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const loadComments = async () => {
        try {
            const res = await fetch(`${API_BASE}/posts/${post.post_id}/comments`, { headers: authHeaders() });
            if (res.ok) setComments(await res.json());
        } catch (err) { console.error(err); }
    };

    const toggleLike = async () => {
        if (!user) return alert('Log in to like posts');
        try {
            const res = await fetch(`${API_BASE}/posts/${post.post_id}/like`, { method: 'POST', headers: authHeaders() });
            if (res.ok) { const d = await res.json(); onLikeToggled(post.post_id, d.liked, d.likeCount); }
        } catch (err) { console.error(err); }
    };

    const submitComment = async (pid = null) => {
        const text = pid ? replyContent : newComment;
        if (!text.trim() || !user) return;

        try {
            const res = await fetch(`${API_BASE}/posts/${post.post_id}/comments`, {
                method: 'POST', 
                headers: authHeaders(),
                body: JSON.stringify({ content: text, parent_id: pid }),
            });
            if (res.ok) { 
                const created = await res.json();
                setComments([...comments, created]); 
                if (pid) {
                    setReplyToId(null);
                    setReplyContent('');
                } else {
                    setNewComment(''); 
                }
            }
        } catch (err) { console.error(err); }
    };

    const handleEdit = async () => {
        if (!editContent.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/posts/${post.post_id}`, {
                method: 'PUT', headers: authHeaders(),
                body: JSON.stringify({ content: editContent }),
            });
            if (res.ok) { onPostUpdated({ ...post, content: editContent, updated_at: new Date().toISOString() }); setEditing(false); }
        } catch (err) { console.error(err); }
    };

    const handleReport = async (postId = null, commentId = null) => {
        if (!user) return alert('Log in to report content');
        const reason = window.prompt("Why are you reporting this content? (Spam, Harassment, Spoilers, etc.)");
        if (!reason || !reason.trim()) return;

        try {
            const res = await fetch(`${API_BASE}/social/report`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ post_id: postId, comment_id: commentId, reason: reason.trim() })
            });
            if (res.ok) alert("Thank you. Your report has been submitted to the Administrators.");
            else alert("Failed to submit report.");
        } catch (err) { console.error(err); }
    };

    const handleDelete = async () => {
        if (!window.confirm('Delete this post?')) return;
        try {
            const res = await fetch(`${API_BASE}/posts/${post.post_id}`, { method: 'DELETE', headers: authHeaders() });
            if (res.ok) onPostDeleted(post.post_id);
        } catch (err) { console.error(err); }
    };

    const isOwner = user && (user.id === post.user_id || user.user_id === post.user_id);

    return (
        <div className="post-card">
            <div className="post-card-header">
                <div className="post-author-info" onClick={() => navigate(`/user/${post.user_id}`)}>
                    <div className="post-avatar">
                        {post.profile_picture ? <img src={post.profile_picture} alt="Avatar" /> : post.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="post-author-name">{post.username}</div>
                        <div className="post-timestamp">
                            {timeAgo(post.created_at)}
                            {post.updated_at && post.updated_at !== post.created_at && <span className="post-edited-tag">(edited)</span>}
                        </div>
                    </div>
                </div>

                <div className="post-menu-container" ref={menuRef}>
                    <button className="post-menu-btn" onClick={() => setShowMenu(v => !v)}>···</button>
                    {showMenu && (
                        <div className="post-menu-dropdown">
                            {isOwner && <button className="post-menu-item" onClick={() => { setEditing(true); setShowMenu(false); }}>✏️ Edit</button>}
                            {isOwner && <button className="post-menu-item delete" onClick={handleDelete}>🗑️ Delete</button>}
                            {!isOwner && <button className="post-menu-item" onClick={() => { handleReport(post.post_id); setShowMenu(false); }}>🚩 Report</button>}
                        </div>
                    )}
                </div>
            </div>

            {editing ? (
                <>
                    <MentionInput 
                        className="post-edit-area" 
                        value={editContent} 
                        onChange={v => setEditContent(v)} 
                        autoFocus 
                    />
                    <div className="post-edit-actions">
                        <button className="edit-save-btn" onClick={handleEdit}>Save</button>
                        <button className="edit-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                </>
            ) : (
                <div className="post-content">{renderWithMentions(post.content, navigate)}</div>
            )}

            {post.image && <img src={post.image} alt="attachment" className="post-image" />}

            <div className="post-footer">
                <button className={`post-action-btn ${post.liked_by_me ? 'liked' : ''}`} onClick={toggleLike}>
                    <span className="like-icon">❤️</span> {post.like_count}
                </button>
                <button className="post-action-btn" onClick={() => { if (!showComments) loadComments(); setShowComments(!showComments); }}>
                    💬 {post.comment_count}
                </button>
            </div>

            {showComments && (
                <div className="comments-section">
                    {comments.filter(c => !c.parent_id).map(c => (
                        <CommentItem 
                            key={c.comment_id}
                            comment={c} 
                            allComments={comments}
                            user={user}
                            onDelete={(id) => setComments(comments.filter(x => x.comment_id !== id))}
                            onReply={setReplyToId}
                            replyToId={replyToId}
                            replyContent={replyContent}
                            setReplyContent={setReplyContent}
                            submitReply={submitComment}
                            handleReport={handleReport}
                            navigate={navigate}
                            level={1}
                        />
                    ))}

                    {user && !replyToId && (
                        <div className="add-comment-form">
                            <MentionInput
                                className="comment-input" 
                                placeholder="Add a comment…"
                                value={newComment} 
                                onChange={v => setNewComment(v)}
                                onKeyDown={e => e.key === 'Enter' && submitComment()}
                            />
                            <button className="comment-submit-btn" disabled={!newComment.trim()} onClick={() => submitComment()}>➤</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function CommentItem({ 
    comment, allComments, user, onDelete, onReply, replyToId, 
    replyContent, setReplyContent, submitReply, handleReport, navigate, level 
}) {
    const replies = allComments.filter(r => r.parent_id === comment.comment_id);
    const isOwner = user && (user.id === comment.user_id || user.user_id === comment.user_id);

    return (
        <div className={`comment-thread-container level-${level}`}>
            <div className="comment-item">
                <div className="comment-avatar">
                    {comment.profile_picture ? <img src={comment.profile_picture} alt="Avatar" /> : comment.username.charAt(0).toUpperCase()}
                </div>
                <div className="comment-bubble">
                    <div className="comment-author">{comment.username}</div>
                    <div className="comment-text">{renderWithMentions(comment.content, navigate)}</div>
                    <div className="comment-meta">
                        <span className="comment-time">{timeAgo(comment.created_at)}</span>
                        {level < 3 && user && (
                            <button className="comment-action-link" onClick={() => onReply(comment.comment_id)}>Reply</button>
                        )}
                        {isOwner ? (
                            <button className="comment-action-link delete" onClick={async () => {
                                if (window.confirm('Delete this comment?')) {
                                    await fetch(`http://localhost:5000/api/comments/${comment.comment_id}`, { method: 'DELETE', headers: authHeaders() });
                                    onDelete(comment.comment_id);
                                }
                            }}>Delete</button>
                        ) : (
                            <button className="comment-action-link" onClick={() => handleReport(null, comment.comment_id)}>Report</button>
                        )}
                    </div>
                </div>
            </div>

            {replyToId === comment.comment_id && (
                <div className="reply-form-inline">
                    <MentionInput
                        className="comment-input small" 
                        placeholder={`Reply to ${comment.username}...`}
                        value={replyContent} 
                        onChange={v => setReplyContent(v)}
                        autoFocus
                    />
                    <div className="reply-form-actions">
                        <button className="reply-submit-btn" onClick={() => submitReply(comment.comment_id)}>Reply</button>
                        <button className="reply-cancel-btn" onClick={() => onReply(null)}>Cancel</button>
                    </div>
                </div>
            )}

            {replies.length > 0 && (
                <div className="comment-replies-list">
                    {replies.map(r => (
                        <CommentItem 
                            key={r.comment_id}
                            comment={r} 
                            allComments={allComments}
                            user={user}
                            onDelete={onDelete}
                            onReply={onReply}
                            replyToId={replyToId}
                            replyContent={replyContent}
                            setReplyContent={setReplyContent}
                            submitReply={submitReply} 
                            handleReport={handleReport}
                            navigate={navigate}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function CreateDiscussionModal({ user, onClose, onCreated, navigate }) {
    const [title, setTitle]               = useState('');
    const [access, setAccess]             = useState('public');
    const [movies, setMovies]             = useState([]);
    const [searchQ, setSearchQ]           = useState('');
    const [selectedMovie, setSelectedMovie] = useState(null);

    useEffect(() => {
        if (searchQ.length < 2) return setMovies([]);
        const to = setTimeout(async () => {
            const { data, error } = await supabase
                .from('movies').select('id, title, poster_path, release_date')
                .ilike('title', `%${searchQ}%`).limit(5);
            if (!error && data) setMovies(data);
        }, 300);
        return () => clearTimeout(to);
    }, [searchQ]);

    const handleSubmit = async () => {
        if (!title.trim() || !selectedMovie) return alert('Select a movie and give your room a title!');
        try {
            const res = await fetch(`${API_BASE}/discussions`, {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ title, access_level: access, movie_id: selectedMovie.id }),
            });
            if (res.ok) {
                const group = await res.json();
                onCreated(); onClose();
                navigate(`/social/discussion/${group.id}`);
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'Failed to create room'}`);
            }
        } catch (e) { alert('Something went wrong.'); }
    };

    return (
        <div className="messenger-overlay">
            <div className="create-post-card" style={{ width: '500px', zIndex: 3000 }}>
                <h2 style={{ marginTop: 0, fontFamily: 'Outfit, sans-serif' }}>🎬 Host a Movie Discussion</h2>

                <label style={{ display: 'block', margin: '15px 0 5px', fontSize: '13px', opacity: 0.7 }}>Room Title</label>
                <input type="text" className="create-post-textarea" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Inception Ending Explained!" />

                <label style={{ display: 'block', margin: '15px 0 5px', fontSize: '13px', opacity: 0.7 }}>Movie Topic</label>
                {!selectedMovie ? (
                    <div>
                        <input type="text" className="create-post-textarea" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search our database…" />
                        {movies.map(m => (
                            <div key={m.id} onClick={() => setSelectedMovie(m)}
                                style={{ display: 'flex', padding: '10px', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', margin: '5px 0', borderRadius: '10px', alignItems: 'center', gap: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                {m.poster_path && <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} alt="" style={{ width: '28px', borderRadius: '4px' }} />}
                                <span>{m.title} ({m.release_date?.substring(0, 4)})</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', padding: '10px', background: 'rgba(245,197,24,0.07)', alignItems: 'center', borderRadius: '10px', gap: '10px', border: '1px solid rgba(245,197,24,0.2)' }}>
                        {selectedMovie.poster_path && <img src={`https://image.tmdb.org/t/p/w92${selectedMovie.poster_path}`} alt="" style={{ width: '28px', borderRadius: '4px' }} />}
                        <span style={{ flex: 1 }}>{selectedMovie.title}</span>
                        <button onClick={() => setSelectedMovie(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.8)', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                    </div>
                )}

                <label style={{ display: 'block', margin: '15px 0 5px', fontSize: '13px', opacity: 0.7 }}>Access Level</label>
                <select className="create-post-textarea" style={{ height: '44px', cursor: 'pointer' }} value={access} onChange={e => setAccess(e.target.value)}>
                    <option value="public">🌍 Public (open to everyone)</option>
                    <option value="friends">🤝 Friends Only</option>
                    <option value="invite">🔒 Invite Only</option>
                </select>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                    <button className="edit-cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="post-submit-btn" disabled={!title || !selectedMovie} onClick={handleSubmit}>Create Room</button>
                </div>
            </div>
        </div>
    );
}

export default SocialFeed;

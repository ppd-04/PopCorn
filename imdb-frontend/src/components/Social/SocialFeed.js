import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderWithMentions } from '../../utils/MentionsUtil';
import './Social.css';

const API_BASE = 'http://localhost:5000/api';

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
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function SocialFeed({ user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [discussions, setDiscussions] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const navigate = useNavigate();

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/posts`, { headers: authHeaders() });
      if(res.ok) setPosts(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDiscussions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/discussions/feed`, { headers: authHeaders() });
      if(res.ok) setDiscussions(await res.json());
    } catch (err) {}
  }, []);

  useEffect(() => {
    fetchPosts();
    if(user) fetchDiscussions();
  }, [fetchPosts, fetchDiscussions, user]);

  const handlePostCreated = (newPost) => setPosts([newPost, ...posts]);
  const handlePostUpdated = (upd) => setPosts(posts.map(p => p.post_id === upd.post_id ? { ...p, ...upd } : p));
  const handlePostDeleted = (id) => setPosts(posts.filter(p => p.post_id !== id));
  const handleLikeToggled = (id, liked, count) => setPosts(posts.map(p => p.post_id === id ? { ...p, liked_by_me: liked, like_count: count } : p));

  return (
    <div className="social-page layout-3-col">
      <div className="social-container-main">
        {/* LEFT COLUMN: DISCUSSIONS NAV */}
        <div className="social-left-col">
          <div className="social-sidebar-card">
            <h3>💬 Movie Discussions</h3>
            <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '15px' }}>Join global spaces or create your own invite-only groups!</p>
            {user ? (
                <button className="btn-full-width" onClick={() => setShowCreateGroup(true)}>➕ Create Discussion Room</button>
            ) : (
                <p style={{ fontSize: '13px', color: '#f5c518' }}>Log in to join discussions.</p>
            )}

            <div className="discussion-list">
                {discussions.map(d => (
                    <div key={d.id} className="discussion-list-item" onClick={() => navigate(`/social/discussion/${d.id}`)}>
                        {d.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w200${d.poster_path}`} alt="poster" className="discussion-thumb" />
                        ) : (
                            <div className="discussion-thumb placeholder">🎬</div>
                        )}
                        <div className="discussion-info">
                            <h4>{d.title}</h4>
                            <span>{d.access_level.toUpperCase()} • {d.movie_title || 'General'}</span>
                        </div>
                    </div>
                ))}
                {discussions.length === 0 && user && <p style={{ opacity: 0.5, fontSize: '13px' }}>No active discussions found.</p>}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: FEED */}
        <div className="social-mid-col">
            <div className="social-header">
                <h1>🍿 The PopCorn Feed</h1>
                <p>Share your thoughts & connect with fellow cinephiles</p>
            </div>

            {user ? (
                <CreatePost user={user} onPostCreated={handlePostCreated} />
            ) : (
                <div className="social-login-prompt"><span>Log in</span> to create posts, like, and comment!</div>
            )}

            {loading ? (
                <div className="social-loading"><div className="spinner"></div><p>Loading feed...</p></div>
            ) : posts.length === 0 ? (
                <div className="social-empty-state"><div className="empty-icon">🎬</div><h3>No posts yet</h3></div>
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

        {/* RIGHT COLUMN: TRENDING */}
        <div className="social-right-col">
            <div className="social-sidebar-card trending-card">
                <h3>🔥 Trending Movies</h3>
                <div className="trending-placeholder">
                    <p style={{fontSize:'13px', opacity:0.7, padding: '20px 0', textAlign: 'center'}}>Checkout the main Browse Page for full analytics.</p>
                </div>
            </div>
            <div className="social-sidebar-card">
                <h3>👥 Connect</h3>
                <button className="btn-secondary-full" onClick={() => navigate('/people')}>🔍 Find People</button>
            </div>
        </div>
      </div>

      {showCreateGroup && <CreateDiscussionModal user={user} onClose={() => setShowCreateGroup(false)} onCreated={fetchDiscussions} navigate={navigate} />}
    </div>
  );
}

// -------------------------------------------------------------
// POST CREATION COMPONENT
// -------------------------------------------------------------
function CreatePost({ user, onPostCreated }) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) return alert('File too large. Maximum size is 10MB.');
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !image) return;
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content, imageBase64: image })
      });
      if (res.ok) {
        onPostCreated(await res.json());
        setContent(''); setImage(null); setImagePreview(null);
      }
    } catch(e) { console.error(e); }
  };

  return (
    <div className="create-post-card">
        <div className="create-post-top">
            <div className="create-post-avatar">
                {user.profile_picture ? <img src={user.profile_picture} alt="Avatar" /> : user.username.charAt(0).toUpperCase()}
            </div>
            <textarea 
                className="create-post-textarea"
                placeholder="Share a thought... Tag movies with @"
                value={content}
                onChange={e => setContent(e.target.value)}
            />
        </div>
        {imagePreview && (
            <div className="create-post-image-preview">
                <img src={imagePreview} alt="Preview" />
                <button className="remove-image-btn" onClick={() => {setImage(null); setImagePreview(null);}}>X</button>
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

// -------------------------------------------------------------
// POST CARD COMPONENT
// -------------------------------------------------------------
function PostCard({ post, user, onPostUpdated, onPostDeleted, onLikeToggled, navigate }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const loadComments = async () => {
      try {
          const res = await fetch(`${API_BASE}/posts/${post.post_id}/comments`, { headers: authHeaders() });
          if(res.ok) setComments(await res.json());
      } catch (err) { console.error(err); }
  };

  const toggleLike = async () => {
      if(!user) return alert("Log in to like");
      try {
          const res = await fetch(`${API_BASE}/posts/${post.post_id}/like`, { method: 'POST', headers: authHeaders() });
          if(res.ok) {
              const data = await res.json();
              onLikeToggled(post.post_id, data.liked, data.likeCount);
          }
      } catch(err) { console.error(err); }
  };

  const submitComment = async () => {
      if(!newComment.trim() || !user) return;
      try {
          const res = await fetch(`${API_BASE}/posts/${post.post_id}/comments`, {
              method: 'POST', headers: authHeaders(),
              body: JSON.stringify({ content: newComment })
          });
          if(res.ok) {
              const created = await res.json();
              setComments([...comments, created]);
              setNewComment('');
          }
      } catch(err) { console.error(err); }
  };

  return (
      <div className="post-card">
          <div className="post-card-header">
              <div className="post-author-info" onClick={() => navigate(`/user/${post.user_id}`)} style={{cursor: 'pointer'}}>
                  <div className="post-avatar">
                      {post.profile_picture ? <img src={post.profile_picture} alt="Avatar" /> : post.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                      <div className="post-author-name">{post.username}</div>
                      <div className="post-timestamp">{timeAgo(post.created_at)}</div>
                  </div>
              </div>
          </div>
          <div className="post-content">
              {renderWithMentions(post.content, navigate)}
          </div>
          {post.image && <img src={post.image} alt="attachment" className="post-image" />}
          
          <div className="post-footer">
              <button className={`post-action-btn ${post.liked_by_me ? 'liked' : ''}`} onClick={toggleLike}>
                  ❤️ {post.like_count}
              </button>
              <button className="post-action-btn" onClick={() => {
                  if(!showComments) loadComments();
                  setShowComments(!showComments);
              }}>
                  💬 {post.comment_count}
              </button>
          </div>

          {showComments && (
              <div className="comments-section">
                  {comments.map(c => (
                      <div key={c.comment_id} className="comment-item">
                          <div className="comment-avatar">
                              {c.profile_picture ? <img src={c.profile_picture} alt="Avatar" /> : c.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="comment-bubble">
                              <div className="comment-author">{c.username}</div>
                              <div className="comment-text">{renderWithMentions(c.content, navigate)}</div>
                              <div className="comment-meta"><span className="comment-time">{timeAgo(c.created_at)}</span></div>
                          </div>
                      </div>
                  ))}
                  {user && (
                      <div className="add-comment-form">
                          <input type="text" className="comment-input" placeholder="Add a comment... (Mentions work here too!)" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment() } />
                          <button className="comment-submit-btn" disabled={!newComment.trim()} onClick={submitComment}>➤</button>
                      </div>
                  )}
              </div>
          )}
      </div>
  );
}

// -------------------------------------------------------------
// CREATE DISCUSSION MODAL
// -------------------------------------------------------------
function CreateDiscussionModal({ user, onClose, onCreated, navigate }) {
    const [title, setTitle] = useState('');
    const [access, setAccess] = useState('public');
    const [movies, setMovies] = useState([]);
    const [searchQ, setSearchQ] = useState('');
    const [selectedMovie, setSelectedMovie] = useState(null);

    // Live search movies to anchor the discussion
    useEffect(() => {
        if(searchQ.length < 2) return setMovies([]);
        const to = setTimeout(async () => {
            const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=ca1ddfce17fe68aa80ce1489069d2eb0&query=${encodeURIComponent(searchQ)}`);
            if(res.ok) {
                const json = await res.json();
                setMovies(json.results.slice(0, 5));
            }
        }, 300);
        return () => clearTimeout(to);
    }, [searchQ]);

    const handleSubmit = async () => {
        if(!title.trim() || !selectedMovie) return alert('Select a topic/movie and name!');
        try {
            const payload = {
                title,
                access_level: access,
                movie_id: selectedMovie.id, // we trust TMDB ID exists, ideally sync to DB, but for now passing TMDB ID directly or linking by name
            };
            const res = await fetch(`${API_BASE}/discussions`, {
                method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
            });
            if(res.ok) {
                const group = await res.json();
                onCreated();
                onClose();
                navigate(`/social/discussion/${group.id}`);
            }
        } catch(e) { console.error(e); }
    };

    return (
        <div className="messenger-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="create-post-card" style={{ width: '500px', backgroundColor: 'var(--bg-color)', zIndex: 3000 }}>
                <h2>Host a Movie Discussion</h2>
                
                <label style={{ display: 'block', margin: '15px 0 5px' }}>Discussion Room Title</label>
                <input type="text" className="create-post-textarea" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Inception Ending Explained!" />
                
                <label style={{ display: 'block', margin: '15px 0 5px' }}>Select Movie Topic</label>
                {!selectedMovie ? (
                    <div>
                        <input type="text" className="create-post-textarea" value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search TMDB for a movie..." />
                        {movies.map(m => (
                            <div key={m.id} style={{ display: 'flex', padding: '10px', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', margin: '5px 0', borderRadius: '8px' }} onClick={() => setSelectedMovie(m)}>
                                {m.poster_path && <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} alt="" style={{width: '30px', marginRight: '10px'}}/>}
                                <span>{m.title} ({m.release_date?.substring(0,4)})</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', padding: '10px', background: 'rgba(255,255,255,0.1)', alignItems: 'center', borderRadius: '8px' }}>
                        <img src={`https://image.tmdb.org/t/p/w92${selectedMovie.poster_path}`} alt="" style={{width: '30px', marginRight: '10px'}}/>
                        <span style={{flex: 1}}>{selectedMovie.title}</span>
                        <button onClick={() => setSelectedMovie(null)} style={{background: 'none', border:'none', color:'red', cursor: 'pointer'}}>Remove</button>
                    </div>
                )}

                <label style={{ display: 'block', margin: '15px 0 5px' }}>Access Level</label>
                <select className="create-post-textarea" style={{ height: '45px' }} value={access} onChange={e=>setAccess(e.target.value)}>
                    <option value="public">🌍 Public (Open to everyone)</option>
                    <option value="friends">🤝 Friends Only</option>
                    <option value="invite">🔒 Invite Only</option>
                </select>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
                    <button className="edit-cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="post-submit-btn" disabled={!title || !selectedMovie} onClick={handleSubmit}>Create Room</button>
                </div>
            </div>
        </div>
    );
}

export default SocialFeed;

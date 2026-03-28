import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Helper: get auth headers
function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}


function SocialFeed({ user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/posts`, { headers: authHeaders() });
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts(posts.map(p => p.post_id === updatedPost.post_id ? { ...p, ...updatedPost } : p));
  };

  const handlePostDeleted = (postId) => {
    setPosts(posts.filter(p => p.post_id !== postId));
  };

  const handleLikeToggled = (postId, liked, likeCount) => {
    setPosts(posts.map(p => 
      p.post_id === postId ? { ...p, liked_by_me: liked, like_count: likeCount } : p
    ));
  };

  return (
    <div className="social-page">
      <div className="social-container">
        <div className="social-header">
          <h1>🍿 PopCorn Social</h1>
          <p>Share your thoughts about movies & connect with fellow cinephiles</p>
        </div>

        {user ? (
          <CreatePost user={user} onPostCreated={handlePostCreated} />
        ) : (
          <div className="social-login-prompt">
            <span>Log in</span> to create posts, like, and comment!
          </div>
        )}

        {loading ? (
          <div className="social-loading">
            <div className="spinner"></div>
            <p>Loading feed...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="social-empty-state">
            <div className="empty-icon">🎬</div>
            <h3>No posts yet</h3>
            <p>Be the first to share something with the community!</p>
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
            />
          ))
        )}
      </div>
    </div>
  );
}

// post er jonno

function CreatePost({ user, onPostCreated }) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result);
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!content.trim() && !image) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: content.trim(), image })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const newPost = await res.json();
      onPostCreated(newPost);
      setContent('');
      removeImage();
    } catch (err) {
      alert('Failed to create post: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-post-card">
      <div className="create-post-top">
        <div className="create-post-avatar">
          {user.profile_picture ? (
            <img src={user.profile_picture} alt="You" />
          ) : '👤'}
        </div>
        <textarea
          className="create-post-textarea"
          placeholder={`What's on your mind, ${user.full_name || user.username || 'friend'}?`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          disabled={isSubmitting}
        />
      </div>

      {imagePreview && (
        <div className="create-post-image-preview">
          <img src={imagePreview} alt="Upload preview" />
          <button className="remove-image-btn" onClick={removeImage} type="button">×</button>
        </div>
      )}

      <div className="create-post-actions">
        <div className="create-post-left-actions">
          <button
            className="action-btn-icon"
            onClick={() => fileRef.current && fileRef.current.click()}
            type="button"
            disabled={isSubmitting}
          >
            📷 Photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="social-file-input-hidden"
          />
        </div>
        <button
          className="post-submit-btn"
          onClick={handleSubmit}
          disabled={isSubmitting || (!content.trim() && !image)}
        >
          {isSubmitting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}


function PostCard({ post, user, onPostUpdated, onPostDeleted, onLikeToggled }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showComments, setShowComments] = useState(false);
  const menuRef = useRef(null);

  const isOwner = user && user.id === post.user_id;
  const isEdited = post.updated_at && new Date(post.updated_at) > new Date(post.created_at);

 
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const handleLike = async () => {
    if (!user) return alert('Please log in to like posts');
    try {
      const res = await fetch(`${API_BASE}/posts/${post.post_id}/like`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      onLikeToggled(post.post_id, data.liked, data.like_count);
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/posts/${post.post_id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ content: editContent.trim(), image: post.image })
      });
      if (!res.ok) throw new Error('Edit failed');
      const updated = await res.json();
      onPostUpdated(updated);
      setIsEditing(false);
    } catch (err) {
      alert('Failed to edit post');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      const res = await fetch(`${API_BASE}/posts/${post.post_id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Delete failed');
      onPostDeleted(post.post_id);
    } catch (err) {
      alert('Failed to delete post');
    }
  };

  return (
    <div className="post-card">
      {/* Header */}
      <div className="post-card-header">
        <div className="post-author-info">
          <div className="post-avatar">
            {post.profile_picture ? (
              <img src={post.profile_picture} alt={post.username} />
            ) : '👤'}
          </div>
          <div>
            <div className="post-author-name">{post.full_name || post.username}</div>
            <div className="post-timestamp">
              {timeAgo(post.created_at)}
              {isEdited && <span className="post-edited-tag">(edited)</span>}
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="post-menu-container" ref={menuRef}>
            <button className="post-menu-btn" onClick={() => setShowMenu(!showMenu)}>⋯</button>
            {showMenu && (
              <div className="post-menu-dropdown">
                <button className="post-menu-item" onClick={() => { setIsEditing(true); setShowMenu(false); }}>
                  ✏️ Edit Post
                </button>
                <button className="post-menu-item delete" onClick={() => { handleDelete(); setShowMenu(false); }}>
                  🗑️ Delete Post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <>
          <textarea
            className="post-edit-area"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            autoFocus
          />
          <div className="post-edit-actions">
            <button className="edit-save-btn" onClick={handleEdit}>Save</button>
            <button className="edit-cancel-btn" onClick={() => { setIsEditing(false); setEditContent(post.content); }}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="post-content">{post.content}</div>
      )}

      {/* Image */}
      {post.image && <img src={post.image} alt="Post" className="post-image" />}

      {/* Footer — Like & Comment buttons */}
      <div className="post-footer">
        <button className={`post-action-btn ${post.liked_by_me ? 'liked' : ''}`} onClick={handleLike}>
          <span className="like-icon">{post.liked_by_me ? '❤️' : '🤍'}</span>
          {post.like_count > 0 ? post.like_count : ''} {post.like_count === 1 ? 'Like' : 'Likes'}
        </button>
        <button className="post-action-btn" onClick={() => setShowComments(!showComments)}>
          💬 {post.comment_count > 0 ? post.comment_count : ''} {post.comment_count === 1 ? 'Comment' : 'Comments'}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <CommentSection postId={post.post_id} user={user} />
      )}
    </div>
  );
}

// cmnt er jonno

function CommentSection({ postId, user }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`${API_BASE}/posts/${postId}/comments`, { headers: authHeaders() });
        const data = await res.json();
        setComments(data);
      } catch (err) {
        console.error('Failed to fetch comments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [postId]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!user) return alert('Please log in to comment');
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: newComment.trim() })
      });
      if (!res.ok) throw new Error('Failed');
      const comment = await res.json();
      setComments([...comments, comment]);
      setNewComment('');
    } catch (err) {
      alert('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Failed');
      setComments(comments.filter(c => c.comment_id !== commentId));
    } catch (err) {
      alert('Failed to delete comment');
    }
  };

  if (loading) return <div className="comments-section" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading comments...</div>;

  return (
    <div className="comments-section">
      {comments.map(comment => (
        <div key={comment.comment_id} className="comment-item">
          <div className="comment-avatar">
            {comment.profile_picture ? (
              <img src={comment.profile_picture} alt={comment.username} />
            ) : '👤'}
          </div>
          <div className="comment-bubble">
            <div className="comment-author">{comment.full_name || comment.username}</div>
            <div className="comment-text">{comment.content}</div>
            <div className="comment-meta">
              <span className="comment-time">{timeAgo(comment.created_at)}</span>
              {user && user.id === comment.user_id && (
                <button className="comment-delete-btn" onClick={() => handleDeleteComment(comment.comment_id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <form className="add-comment-form" onSubmit={handleSubmitComment}>
        <div className="comment-avatar">
          {user && user.profile_picture ? (
            <img src={user.profile_picture} alt="You" />
          ) : '👤'}
        </div>
        <input
          className="comment-input"
          placeholder={user ? "Write a comment..." : "Log in to comment..."}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={submitting}
        />
        <button
          className="comment-submit-btn"
          type="submit"
          disabled={submitting || !newComment.trim()}
        >
          ➤
        </button>
      </form>
    </div>
  );
}

export default SocialFeed;

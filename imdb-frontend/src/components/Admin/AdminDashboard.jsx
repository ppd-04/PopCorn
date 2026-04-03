import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

function AdminDashboard({ theme }) {
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [message, setMessage] = useState('');
  
  // Movie Add Form state
  const [movieForm, setMovieForm] = useState({
    title: '',
    overview: '',
    poster_path: '',
    release_date: ''
  });

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to permanently ban this user? All their comments and likes will be archived and deleted.")) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setMessage('User successfully banned and archived.');
        setTimeout(() => setMessage(''), 3000);
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMovieChange = (e) => {
    setMovieForm({ ...movieForm, [e.target.name]: e.target.value });
  };

  const handleAddMovie = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/admin/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(movieForm)
      });
      if (res.ok) {
        setMessage('Movie manually inserted into database.');
        setTimeout(() => setMessage(''), 3000);
        setMovieForm({ title: '', overview: '', poster_path: '', release_date: '' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={`admin-dashboard ${theme}`}>
      <h1>👑 Admin Interface</h1>
      {message && <div className="admin-message">{message}</div>}
      
      <div className="admin-tabs">
        <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>👤 User Moderation</button>
        <button className={activeTab === 'movies' ? 'active' : ''} onClick={() => setActiveTab('movies')}>🎬 Manual Movie Entry</button>
      </div>

      <div className="admin-content">
        {activeTab === 'users' && (
          <div className="admin-users-list">
            <h2>Registered Users</h2>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id}>
                    <td>{u.user_id}</td>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.is_admin ? <span className="admin-badge">Admin</span> : 'User'}</td>
                    <td>
                      {!u.is_admin && (
                        <button className="btn-ban" onClick={() => handleDeleteUser(u.user_id)}>Ban</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'movies' && (
          <div className="admin-movie-form">
            <h2>Insert Movie to Database</h2>
            <form onSubmit={handleAddMovie}>
              <div className="form-group">
                <label>Movie Title</label>
                <input type="text" name="title" value={movieForm.title} onChange={handleMovieChange} required />
              </div>
              <div className="form-group">
                <label>Poster URL (Leave empty for TMDB fetching if script is enabled)</label>
                <input type="text" name="poster_path" value={movieForm.poster_path} onChange={handleMovieChange} />
              </div>
              <div className="form-group">
                <label>Relese Date</label>
                <input type="date" name="release_date" value={movieForm.release_date} onChange={handleMovieChange} />
              </div>
              <div className="form-group">
                <label>Overview</label>
                <textarea name="overview" value={movieForm.overview} onChange={handleMovieChange} rows={4} required />
              </div>
              <button type="submit" className="btn-submit">Add Movie directly</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;

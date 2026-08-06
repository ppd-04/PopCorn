import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

const API_BASE = 'https://popcorn-s9v4.onrender.com/api/admin';
const TMDB_KEY = 'ffb76769eee5be098b949fd3877a9d0b';

function AdminDashboard({ theme }) {
  const [activeTab, setActiveTab] = useState('users');
  const [message, setMessage] = useState('');
  
  // Data States
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [contentResults, setContentResults] = useState([]);
  const [contentSearch, setContentSearch] = useState('');
  
  // Current admin status from localStorage (Initial fast check)
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const initialIsSuperAdmin = currentUser.is_super_admin || false;
  const currentUserId = currentUser.id || currentUser.user_id;

  // Live admin status synced from database fetch
  const [isSuperAdminLive, setIsSuperAdminLive] = useState(initialIsSuperAdmin);
  const isSuperAdmin = initialIsSuperAdmin || isSuperAdminLive;
  
  // Form States
  const [movieForm, setMovieForm] = useState({ tmdb_id: '', title: '', original_title: '', overview: '', release_date: '', poster_path: '', backdrop_path: '', popularity: 0, vote_average: 0, vote_count: 0, original_language: 'en' });
  const [seriesForm, setSeriesForm] = useState({ tmdb_id: '', name: '', original_name: '', overview: '', first_air_date: '', poster_path: '', popularity: 0, vote_average: 0, vote_count: 0, original_language: 'en' });
  const [personForm, setPersonForm] = useState({ id: '', name: '', biography: '', profile_path: '', popularity: 0, gender: 0, place_of_birth: '', birthday: '', known_for_department: '' });

  // TMDB Search States
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState([]);

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };
  
  const getAuthHeaders = React.useMemo(() => {
    return () => ({
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    });
  }, []);

  // --- FETCH DATA ---
  const fetchUsers = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        // Sync live superadmin status if found in the list
        const liveUser = data.find(u => u.user_id === currentUserId);
        if (liveUser) setIsSuperAdminLive(liveUser.is_super_admin);
      }
    } catch (e) { console.error(e); }
  }, [getAuthHeaders, currentUserId]);
  
  const fetchLogs = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/logs`, { headers: getAuthHeaders() });
      if (res.ok) setLogs(await res.json());
    } catch (e) { console.error(e); }
  }, [getAuthHeaders]);
  
  const fetchReports = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/reports`, { headers: getAuthHeaders() });
      if (res.ok) setReports(await res.json());
    } catch (e) { console.error(e); }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'logs') fetchLogs();
    else if (activeTab === 'content') {
      fetchReports();
    }
  }, [activeTab, fetchUsers, fetchLogs, fetchReports]);

  // --- USER MODERATION ---
  const handleRoleToggle = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/users/${id}/role`, { method: 'PUT', headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) return showMsg(`Error: ${data.error}`);
      showMsg('User role updated successfully.');
      fetchUsers();
    } catch (e) { console.error(e); }
  };

  const handleBanToggle = async (user) => {
    const currentlyBanned = user.banned_until && new Date(user.banned_until) > new Date();
    
    // If not banned, ask for duration/reason
    let ms = null;
    let reason = "";

    if (!currentlyBanned) {
      const choice = window.prompt("Enter ban duration in hours (leave empty for PERMANENT):", "24");
      if (choice === null) return; // User cancelled
      if (choice !== "") ms = parseInt(choice) * 3600000;
      
      reason = window.prompt("Enter reason for ban:", "Violation of community standards");
      if (reason === null) return;
    } else {
      if (!window.confirm(`Unban ${user.username}?`)) return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/${user.user_id}/ban`, { 
        method: 'PUT', 
        headers: getAuthHeaders(),
        body: JSON.stringify({ durationMs: ms, reason })
      });
      const data = await res.json();
      if (!res.ok) return showMsg(`Error: ${data.error}`);
      showMsg(currentlyBanned ? 'User unbanned.' : 'User banned successfully.');
      fetchUsers();
    } catch (e) { console.error(e); }
  };

  // --- TMDB AUTOFILL ---
  const searchTMDB = async (type) => {
    if (!tmdbSearchQuery) return;
    try {
      const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(tmdbSearchQuery)}`;
      const res = await fetch(url);
      const data = await res.json();
      setTmdbResults(data.results || []);
    } catch (e) { console.error(e); }
  };

  const selectTMDBResult = async (item, type) => {
    if (type === 'movie') {
      setMovieForm({
        tmdb_id: item.id || '', title: item.title || '', original_title: item.original_title || '', overview: item.overview || '',
        release_date: item.release_date || '', poster_path: item.poster_path || '', backdrop_path: item.backdrop_path || '',
        popularity: item.popularity || 0, vote_average: item.vote_average || 0, vote_count: item.vote_count || 0, original_language: item.original_language || 'en'
      });
    } else if (type === 'tv') {
      setSeriesForm({
        tmdb_id: item.id || '', name: item.name || '', original_name: item.original_name || '', overview: item.overview || '',
        first_air_date: item.first_air_date || '', poster_path: item.poster_path || '', popularity: item.popularity || 0,
        vote_average: item.vote_average || 0, vote_count: item.vote_count || 0, original_language: item.original_language || 'en'
      });
    } else if (type === 'person') {
      const detRes = await fetch(`https://api.themoviedb.org/3/person/${item.id}?api_key=${TMDB_KEY}`);
      const det = await detRes.json();
      setPersonForm({
        id: det.id || '', name: det.name || '', biography: det.biography || '', profile_path: det.profile_path || '',
        popularity: det.popularity || 0, gender: det.gender || 0, place_of_birth: det.place_of_birth || '', birthday: det.birthday || '', known_for_department: det.known_for_department || ''
      });
    }
    setTmdbResults([]);
    setTmdbSearchQuery('');
  };

  // --- SUBMISSIONS ---
  const submitEntity = async (endpoint, payload, resetFunc) => {
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) return showMsg(`Error: ${data.error}`);
      showMsg(`${endpoint} entry saved successfully!`);
      resetFunc();
    } catch (e) { console.error(e); }
  };

  // --- CONTENT MODERATION ---
  const searchContent = async () => {
    if (!contentSearch) return;
    try {
      const res = await fetch(`${API_BASE}/content/search?query=${encodeURIComponent(contentSearch)}`, { headers: getAuthHeaders() });
      if (res.ok) setContentResults(await res.json());
    } catch (e) { console.error(e); }
  };

  const deleteContent = async (id, type) => {
    if (!window.confirm("Delete this content permanently?")) return;
    try {
      const res = await fetch(`${API_BASE}/${type}s/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) {
        showMsg("Content deleted.");
        setContentResults(contentResults.filter(c => !(c.id === id && c.type === type)));
      }
    } catch (e) { console.error(e); }
  };


  return (
    <div className={`admin-dashboard ${theme}`}>
      <div className="admin-header">
        <h1>👑 Command Center</h1>
        <p>Premium Administrative Dashboard</p>
      </div>
      
      {message && <div className="admin-message sliding">{message}</div>}
      
      <div className="admin-tabs">
        <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>👤 Users</button>
        <button className={activeTab === 'movies' ? 'active' : ''} onClick={() => setActiveTab('movies')}>🎬 Movies</button>
        <button className={activeTab === 'series' ? 'active' : ''} onClick={() => setActiveTab('series')}>📺 Series</button>
        <button className={activeTab === 'people' ? 'active' : ''} onClick={() => setActiveTab('people')}>👥 People</button>
        <button className={activeTab === 'content' ? 'active' : ''} onClick={() => setActiveTab('content')}>🛡️ Content</button>
        <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>📜 Logs</button>
      </div>

      <div className="admin-content-area glass-panel">
        
        {/* ================= USERS TAB ================= */}
        {activeTab === 'users' && (
          <div className="admin-panel users">
            <h2>User Moderation</h2>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                   {users.map(u => {
                    const isSelf = u.user_id === currentUserId;
                    const isTargetAdmin = u.is_admin || u.is_super_admin;
                    const canModerate = isSuperAdmin ? !isSelf : (!isTargetAdmin && !isSelf);
                    const canToggleRole = isSuperAdmin ? !isSelf : (!isTargetAdmin && !isSelf);
                    // Special case: Normal admins can promote, but not demote.
                    // The backend handles the demotion block, but we hide/disable UI here.
                    const isBanned = u.banned_until && new Date(u.banned_until) > new Date();

                    return (
                      <tr key={u.user_id} className={isSelf ? 'current-user-row' : ''}>
                        <td>{u.user_id}</td>
                        <td>{u.username} {isSelf && <small>(You)</small>}</td>
                        <td>{u.email}</td>
                        <td>
                          {u.is_super_admin ? <span className="badge super">Super Admin</span> : 
                           u.is_admin ? <span className="badge admin">Admin</span> : 'User'}
                        </td>
                        <td>
                          {isBanned ? <span className="badge banned">Banned</span> : <span className="badge active">Active</span>}
                        </td>
                        <td className="actions-cell">
                          {canToggleRole && (
                            <button 
                              className={`btn-action admin-toggle ${u.is_admin ? 'demote' : 'promote'}`} 
                              onClick={() => handleRoleToggle(u.user_id)}
                              disabled={u.is_admin && !isSuperAdmin}
                            >
                              {u.is_admin ? 'Demote Admin' : 'Promote to Admin'}
                            </button>
                          )}
                          {canModerate && (
                            <button 
                              className={`btn-action ${isBanned ? 'unban' : 'ban'}`} 
                              onClick={() => handleBanToggle(u)}
                            >
                              {isBanned ? 'Unban' : 'Ban User'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= MOVIES TAB ================= */}
        {activeTab === 'movies' && (
          <div className="admin-panel form-panel">
            <h2>Add / Modify Movie</h2>
            
            <div className="tmdb-search-box">
              <input type="text" placeholder="Search TMDB for auto-fill..." value={tmdbSearchQuery} onChange={e => setTmdbSearchQuery(e.target.value)} />
              <button onClick={() => searchTMDB('movie')}>Search TMDB</button>
            </div>
            {tmdbResults.length > 0 && (
               <div className="tmdb-results">
                 {tmdbResults.map(r => (
                   <div key={r.id} className="tmdb-item" onClick={() => selectTMDBResult(r, 'movie')}>
                     {r.poster_path && <img src={`https://image.tmdb.org/t/p/w92${r.poster_path}`} alt="poster" />}
                     <div>
                       <strong>{r.title}</strong> <span>({r.release_date})</span>
                     </div>
                   </div>
                 ))}
               </div>
            )}

            <form onSubmit={e => { e.preventDefault(); submitEntity('movies', movieForm, () => setMovieForm({tmdb_id: '', title: '', original_title: '', overview: '', release_date: '', poster_path: '', backdrop_path: '', popularity: 0, vote_average: 0, vote_count: 0, original_language: 'en'})); }}>
              <div className="form-grid">
                <input type="number" placeholder="TMDB ID" required value={movieForm.tmdb_id} onChange={e => setMovieForm({...movieForm, tmdb_id: e.target.value})} />
                <input type="text" placeholder="Title" required value={movieForm.title} onChange={e => setMovieForm({...movieForm, title: e.target.value})} />
                <input type="text" placeholder="Original Title" value={movieForm.original_title} onChange={e => setMovieForm({...movieForm, original_title: e.target.value})} />
                <input type="date" placeholder="Release Date" required value={movieForm.release_date} onChange={e => setMovieForm({...movieForm, release_date: e.target.value})} />
                <input type="text" placeholder="Poster Path (/...jpg)" value={movieForm.poster_path} onChange={e => setMovieForm({...movieForm, poster_path: e.target.value})} />
                <input type="text" placeholder="Backdrop Path (/...jpg)" value={movieForm.backdrop_path} onChange={e => setMovieForm({...movieForm, backdrop_path: e.target.value})} />
                <input type="number" step="0.1" placeholder="Popularity" value={movieForm.popularity} onChange={e => setMovieForm({...movieForm, popularity: e.target.value})} />
                <input type="number" step="0.1" placeholder="Vote Avg" value={movieForm.vote_average} onChange={e => setMovieForm({...movieForm, vote_average: e.target.value})} />
              </div>
              <textarea placeholder="Overview" required value={movieForm.overview} onChange={e => setMovieForm({...movieForm, overview: e.target.value})} rows="4" />
              <button type="submit" className="btn-submit">💾 Insert Movie Record</button>
            </form>
          </div>
        )}

        {/* ================= SERIES TAB ================= */}
        {activeTab === 'series' && (
          <div className="admin-panel form-panel">
            <h2>Add / Modify Series</h2>
            <div className="tmdb-search-box">
              <input type="text" placeholder="Search TMDB for TV Shows..." value={tmdbSearchQuery} onChange={e => setTmdbSearchQuery(e.target.value)} />
              <button onClick={() => searchTMDB('tv')}>Search TMDB</button>
            </div>
            {tmdbResults.length > 0 && (
               <div className="tmdb-results">
                 {tmdbResults.map(r => (
                   <div key={r.id} className="tmdb-item" onClick={() => selectTMDBResult(r, 'tv')}>
                     {r.poster_path && <img src={`https://image.tmdb.org/t/p/w92${r.poster_path}`} alt="poster" />}
                     <div><strong>{r.name}</strong> <span>({r.first_air_date})</span></div>
                   </div>
                 ))}
               </div>
            )}
            <form onSubmit={e => { e.preventDefault(); submitEntity('series', seriesForm, () => setSeriesForm({tmdb_id: '', name: '', original_name: '', overview: '', first_air_date: '', poster_path: '', popularity: 0, vote_average: 0, vote_count: 0, original_language: 'en'})); }}>
              <div className="form-grid">
                <input type="number" placeholder="TMDB ID" required value={seriesForm.tmdb_id} onChange={e => setSeriesForm({...seriesForm, tmdb_id: e.target.value})} />
                <input type="text" placeholder="Name" required value={seriesForm.name} onChange={e => setSeriesForm({...seriesForm, name: e.target.value})} />
                <input type="text" placeholder="Original Name" value={seriesForm.original_name} onChange={e => setSeriesForm({...seriesForm, original_name: e.target.value})} />
                <input type="date" placeholder="First Air Date" required value={seriesForm.first_air_date} onChange={e => setSeriesForm({...seriesForm, first_air_date: e.target.value})} />
                <input type="text" placeholder="Poster Path" value={seriesForm.poster_path} onChange={e => setSeriesForm({...seriesForm, poster_path: e.target.value})} />
              </div>
              <textarea placeholder="Overview" required value={seriesForm.overview} onChange={e => setSeriesForm({...seriesForm, overview: e.target.value})} rows="4" />
              <button type="submit" className="btn-submit">💾 Insert Series Record</button>
            </form>
          </div>
        )}

        {/* ================= PEOPLE TAB ================= */}
        {activeTab === 'people' && (
          <div className="admin-panel form-panel">
            <h2>Add / Modify Person (Actor/Director)</h2>
            <div className="tmdb-search-box">
              <input type="text" placeholder="Search TMDB for People..." value={tmdbSearchQuery} onChange={e => setTmdbSearchQuery(e.target.value)} />
              <button onClick={() => searchTMDB('person')}>Search TMDB</button>
            </div>
            {tmdbResults.length > 0 && (
               <div className="tmdb-results">
                 {tmdbResults.map(r => (
                   <div key={r.id} className="tmdb-item" onClick={() => selectTMDBResult(r, 'person')}>
                     {r.profile_path && <img src={`https://image.tmdb.org/t/p/w92${r.profile_path}`} alt="profile" />}
                     <div><strong>{r.name}</strong> <span>({r.known_for_department})</span></div>
                   </div>
                 ))}
               </div>
            )}
            <form onSubmit={e => { e.preventDefault(); submitEntity('people', personForm, () => setPersonForm({id: '', name: '', biography: '', profile_path: '', popularity: 0, gender: 0, place_of_birth: '', birthday: '', known_for_department: ''})); }}>
              <div className="form-grid">
                <input type="number" placeholder="TMDB ID" required value={personForm.id} onChange={e => setPersonForm({...personForm, id: e.target.value})} />
                <input type="text" placeholder="Name" required value={personForm.name} onChange={e => setPersonForm({...personForm, name: e.target.value})} />
                <input type="text" placeholder="Department (Acting, Directing)" required value={personForm.known_for_department} onChange={e => setPersonForm({...personForm, known_for_department: e.target.value})} />
                <input type="date" placeholder="Birthday" value={personForm.birthday} onChange={e => setPersonForm({...personForm, birthday: e.target.value})} />
                <input type="text" placeholder="Place of Birth" value={personForm.place_of_birth} onChange={e => setPersonForm({...personForm, place_of_birth: e.target.value})} />
                <input type="text" placeholder="Profile Path (/...jpg)" value={personForm.profile_path} onChange={e => setPersonForm({...personForm, profile_path: e.target.value})} />
              </div>
              <textarea placeholder="Biography" required value={personForm.biography} onChange={e => setPersonForm({...personForm, biography: e.target.value})} rows="5" />
              <button type="submit" className="btn-submit">💾 Insert Person Record</button>
            </form>
          </div>
        )}

        {/* ================= CONTENT MODERATION ================= */}
        {activeTab === 'content' && (
          <div className="admin-panel">
            <h2>Reported Content</h2>
            <div className="reports-grid">
              {reports.length === 0 ? <p className="no-data">No pending reports.</p> : reports.map(r => (
                <div key={r.id} className="report-card glass-panel">
                  <div className="report-header">
                    <span className="badge urgency-high">REPORT #{r.id}</span>
                    <span className="reporter">By: @{r.reporter_username}</span>
                  </div>
                  <div className="report-body">
                    <p><strong>Reason:</strong> {r.reason}</p>
                    <div className="flagged-content">
                      <p className="author">Author: @{r.post_author || r.comment_author}</p>
                      <p className="text">"{r.post_content || r.comment_content}"</p>
                    </div>
                  </div>
                  <div className="report-footer">
                    <button className="btn-ban" onClick={() => deleteContent(r.post_id || r.comment_id, r.post_id ? 'post' : 'comment')}>🗑️ Strip Content</button>
                  </div>
                </div>
              ))}
            </div>

            <hr style={{margin: '40px 0', opacity: 0.1}} />

            <h2>Global Content Search</h2>
            <div className="tmdb-search-box">
              <input type="text" placeholder="Search posts and comments..." value={contentSearch} onChange={e => setContentSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchContent()} />
              <button onClick={searchContent}>Search Network</button>
            </div>
            
            <div className="content-results">
              {contentResults.map(item => (
                <div key={`${item.type}-${item.id}`} className="content-card">
                  <div className="content-meta">
                    <span className={`badge ${item.type}`}>{item.type.toUpperCase()}</span>
                    <strong>@{item.username}</strong>
                    <span className="date">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <p className="content-text">{item.content}</p>
                  <button className="btn-ban" onClick={() => deleteContent(item.id, item.type)}>🗑️ Delete</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= LOGS TAB ================= */}
        {activeTab === 'logs' && (
          <div className="admin-panel">
            <h2>Audit Logs</h2>
            <p style={{ opacity: 0.7, marginBottom: '20px' }}>Tracking administrative actions across the network.</p>
            <div className="table-responsive logs-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.log_id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td>{log.username} ({log.email})</td>
                      <td><span className={`badge action-${log.action_type.toLowerCase()}`}>{log.action_type}</span></td>
                      <td>{log.target_entity} #{log.target_id}</td>
                      <td>{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default AdminDashboard;

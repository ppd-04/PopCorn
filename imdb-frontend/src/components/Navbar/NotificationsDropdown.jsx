import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function NotificationsDropdown({ theme }) {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch('http://localhost:5000/api/notifications', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setNotifications(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 30 seconds for new notifications
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const onDocClick = (e) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [isOpen]);

    const markAsRead = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleFriendAction = async (action, senderId, notifId) => {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            const url = `http://localhost:5000/api/friends/${action}/${senderId}`;
            
            const res = await fetch(url, { method: 'POST', headers });
            if (res.ok) {
                // remove or mark read the notification
                markAsRead(notifId);
                // Refresh list quickly
                fetchNotifications();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="nav-notifications" ref={dropdownRef} style={{ position: 'relative' }}>
            <span 
                className="nav-link" 
                onClick={() => setIsOpen(!isOpen)} 
                style={{ cursor: 'pointer', position: 'relative' }}
            >
                🔔
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-10px',
                        backgroundColor: '#ff3b30',
                        color: 'white',
                        borderRadius: '50%',
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                    }}>
                        {unreadCount}
                    </span>
                )}
            </span>

            {isOpen && (
                <div 
                    className={`dropdown-menu ${theme}`}
                    style={{
                        position: 'absolute',
                        top: '40px',
                        right: '-20px',
                        width: '350px',
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                        padding: '15px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        zIndex: 1000
                    }}
                >
                    <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Notifications</h3>
                    
                    {notifications.length === 0 ? (
                        <p style={{ margin: 0, opacity: 0.6, textAlign: 'center' }}>No notifications yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {notifications.map(n => (
                                <div key={n.id} style={{ 
                                    padding: '10px', 
                                    backgroundColor: n.is_read ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    gap: '10px'
                                }}>
                                    <img 
                                        src={n.sender_picture || 'https://via.placeholder.com/40'} 
                                        alt="Avatar" 
                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                    <div style={{ flex: 1, fontSize: '14px' }}>
                                        <p style={{ margin: '0 0 5px 0' }}>{n.message}</p>
                                        <span style={{ fontSize: '11px', opacity: 0.5 }}>{new Date(n.created_at).toLocaleString()}</span>
                                        
                                        {!n.is_read && n.type === 'friend_request' && (
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                <button 
                                                    style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer', backgroundColor: '#007aff', color: 'white', border: 'none', borderRadius: '6px' }}
                                                    onClick={() => handleFriendAction('accept', n.sender_id, n.id)}
                                                >
                                                    Accept
                                                </button>
                                                <button 
                                                    style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                                                    onClick={() => handleFriendAction('reject', n.sender_id, n.id)}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {!n.is_read && n.type !== 'friend_request' && (
                                        <button 
                                            onClick={() => markAsRead(n.id)}
                                            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#007aff', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            Mark Read
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default NotificationsDropdown;

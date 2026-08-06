import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

function NotificationsDropdown({ theme }) {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            // Using the same base pattern as other components
            const base = 'https://popcorn-s9v4.onrender.com/api';
            const res = await fetch(`${base}/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // Real-time support via Socket.io
        const socket = io('https://popcorn-s9v4.onrender.com');
        const userData = localStorage.getItem('user');
        if (userData) {
            const user = JSON.parse(userData);
            const userId = user.id || user.user_id;
            socket.emit('join_discussion', `user_${userId}`); // reusing join for private room

            socket.on('new_notification', (notif) => {
                console.log("New notification received via socket:", notif);
                setNotifications(prev => [notif, ...prev]);
            });
        }

        const interval = setInterval(fetchNotifications, 60000);
        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
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
            const base = 'https://popcorn-s9v4.onrender.com/api';
            const res = await fetch(`${base}/notifications/${id}/read`, {
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
            const base = 'https://popcorn-s9v4.onrender.com/api';
            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            const url = `${base}/friends/${action}/${senderId}`;

            const res = await fetch(url, { method: 'POST', headers });
            if (res.ok) {
                // remove or mark notif
                markAsRead(notifId);
                // Refresh list
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
                    className={`notifications-dropdown ${theme || 'dark'}`}
                    style={{
                        position: 'absolute',
                        top: '50px',
                        right: '-10px',
                        width: '380px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid rgba(245, 197, 24, 0.3)',
                        borderRadius: '16px',
                        boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
                        padding: '20px',
                        maxHeight: '500px',
                        overflowY: 'auto',
                        zIndex: 2000,
                        display: 'block',
                        opacity: 1,
                        visibility: 'visible'
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
                                    {n.sender_picture ? (
                                        <img
                                            src={n.sender_picture}
                                            alt="Avatar"
                                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            backgroundColor: '#f5c518',
                                            color: '#000',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '18px',
                                            flexShrink: 0
                                        }}>
                                            {(n.sender_username || '?')[0].toUpperCase()}
                                        </div>
                                    )}
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

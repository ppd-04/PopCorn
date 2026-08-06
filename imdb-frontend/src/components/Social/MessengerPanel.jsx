import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { renderWithMentions } from '../../utils/MentionsUtil';
import MentionInput from './MentionInput';
import './Social.css';
import './MessengerUpgraded.css';

const API_BASE = 'https://popcorn-s9v4.onrender.com/api';

function MessengerPanel({ user, isOpen, onClose }) {
    const [tab, setTab] = useState('all'); 
    const [friends, setFriends] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeChat, setActiveChat] = useState(null); 
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const fetchAllData = useCallback(async () => {
        if (!isOpen || !user) return;
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            const [friendsRes, convRes] = await Promise.all([
                fetch(`${API_BASE}/messages/friends`, { headers }),
                fetch(`${API_BASE}/chat/conversations`, { headers })
            ]);
            
            if (friendsRes.ok) setFriends(await friendsRes.json());
            if (convRes.ok) setConversations(await convRes.json());
        } catch (err) {
            console.error(err);
        }
    }, [isOpen, user]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE}/chat/search?q=${searchQuery}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) setSearchResults(await res.json());
            } catch (err) { console.error(err); }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (!isOpen || !user) return;
        
        socketRef.current = io('https://popcorn-s9v4.onrender.com');
        socketRef.current.emit('join_user', user.userId || user.id);

        socketRef.current.on('receive_dm', (msg) => {
            setActiveChat(prevActive => {
                const currentId = user.userId || user.id;
                const partnerId = prevActive?.user_id || prevActive?.partner_id;
                
                const isRelevant = 
                    (msg.sender_id === currentId && msg.receiver_id === partnerId) || 
                    (msg.sender_id === partnerId && msg.receiver_id === currentId);

                if (isRelevant) {
                    setMessages(prev => [...prev, msg]);
                    if (partnerId) {
                        const token = localStorage.getItem('token');
                        fetch(`${API_BASE}/chat/read/${partnerId}`, { 
                            method: 'POST', 
                            headers: { 'Authorization': `Bearer ${token}` } 
                        });
                    }
                }
                return prevActive;
            });
            fetchAllData();
        });

        return () => socketRef.current?.disconnect();
    }, [isOpen, user, fetchAllData]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const openChat = async (partner) => {
        const partnerId = partner.user_id || partner.partner_id;
        setActiveChat(partner);
        setMessages([]);
        setIsLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };
            
            await fetch(`${API_BASE}/chat/read/${partnerId}`, { method: 'POST', headers });
            
            const res = await fetch(`${API_BASE}/messages/${partnerId}`, { headers });
            if (res.ok) setMessages(await res.json());
            
            fetchAllData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = () => {
        const partnerId = activeChat?.user_id || activeChat?.partner_id;
        if (!input.trim() || !partnerId || !socketRef.current) return;
        
        const msgData = {
            sender_id: user.userId || user.id,
            receiver_id: partnerId,
            message: input
        };
        socketRef.current.emit('send_dm', msgData);
        setInput('');
    };

    if (!isOpen) return null;

    const renderUserRow = (u) => {
        const isPartner = u.partner_id || u.user_id;
        const name = u.full_name || u.username;
        const lastMsg = u.message;
        const unread = u.unread_count;

        return (
            <div key={isPartner} className="messenger-friend-row" onClick={() => { setSearchQuery(''); openChat(u); }}>
                <div className="messenger-friend-avatar">
                    {u.profile_picture
                        ? <img src={u.profile_picture} alt={u.username} />
                        : (u.full_name || u.username || '?').charAt(0).toUpperCase()
                    }
                    {unread > 0 && <span className="unread-dot">{unread}</span>}
                </div>
                <div className="messenger-friend-info">
                    <h4 className="partner-name">{name}</h4>
                    {lastMsg ? (
                        <p className="last-msg-preview">{lastMsg}</p>
                    ) : (
                        <span className="tap-to-chat">Tap to chat</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="messenger-overlay" onClick={onClose} />
            <div className={`messenger-panel upgraded ${activeChat ? 'in-chat' : ''}`}>
                <div className="messenger-header">
                    {activeChat ? (
                        <>
                            <button className="messenger-back" onClick={() => setActiveChat(null)}>⬅</button>
                            <div className="header-user-info">
                                <span className="header-name">{activeChat.full_name || activeChat.username}</span>
                            </div>
                        </>
                    ) : (
                        <div className="messenger-main-header">
                            <h2>Messages</h2>
                            <button className="messenger-close" onClick={onClose}>&times;</button>
                        </div>
                    )}
                </div>

                {!activeChat ? (
                    <div className="messenger-list-view">
                        <div className="messenger-search">
                            <input 
                                type="text" 
                                placeholder="Search users to chat..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {searchQuery.trim() ? (
                            <div className="search-results-section">
                                <h3>Search Results</h3>
                                {searchResults.length === 0 ? <p className="no-result">No users found</p> : searchResults.map(renderUserRow)}
                            </div>
                        ) : (
                            <>
                                <div className="messenger-tabs">
                                    <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All Chats</button>
                                    <button className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>Friends</button>
                                </div>
                                <div className="messenger-friends-list">
                                    {tab === 'all' ? (
                                        conversations.length === 0 ? <p className="empty-msg">No recent messages.</p> : conversations.map(renderUserRow)
                                    ) : (
                                        friends.length === 0 ? <p className="empty-msg">No friends yet.</p> : friends.map(renderUserRow)
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="messenger-chat-room">
                        <div className="messenger-messages">
                            {isLoading ? (
                                <div className="chat-loading-overlay">Loading history...</div>
                            ) : (
                                messages.map(msg => {
                                    const isMine = msg.sender_id === (user.userId || user.id);
                                    return (
                                        <div key={msg.id} className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
                                            {renderWithMentions(msg.message, navigate)}
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="messenger-input-area">
                            <MentionInput 
                                placeholder="Type a message..."
                                value={input}
                                onChange={(v) => setInput(v)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault() || sendMessage())}
                                className="comment-input"
                            />
                            <button className="send-msg-btn" onClick={sendMessage}>➤</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default MessengerPanel;

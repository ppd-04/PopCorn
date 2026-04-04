import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { renderWithMentions } from '../../utils/MentionsUtil';
import MentionInput from './MentionInput';
import './Social.css';

const API_BASE = 'http://localhost:5000/api';

function MessengerPanel({ user, isOpen, onClose }) {
    const [friends, setFriends] = useState([]);
    const [activeChat, setActiveChat] = useState(null); // the user object we are chatting with
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // Fetch friends on open
    useEffect(() => {
        if (!isOpen || !user) return;
        const fetchFriends = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE}/messages/friends`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) setFriends(await res.json());
            } catch (err) {
                console.error(err);
            }
        };
        fetchFriends();
    }, [isOpen, user]);

    // Socket Setup
    useEffect(() => {
        if (!isOpen || !user) return;
        
        socketRef.current = io('http://localhost:5000');
        socketRef.current.emit('join_user', user.userId || user.id);

        socketRef.current.on('receive_dm', (msg) => {
            // Only append if the chat is currently open and it's with the active chat user
            setActiveChat(prevActive => {
                if (prevActive && Math.max(msg.sender_id, msg.receiver_id) === Math.max((user.userId || user.id), prevActive.user_id) && 
                    Math.min(msg.sender_id, msg.receiver_id) === Math.min((user.userId || user.id), prevActive.user_id)) {
                    setMessages(prev => [...prev, msg]);
                }
                return prevActive;
            });
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, [isOpen, user]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const openChat = async (friend) => {
        setActiveChat(friend);
        // Fetch history
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/messages/${friend.user_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setMessages(await res.json());
        } catch (err) {
            console.error(err);
        }
    };

    const sendMessage = () => {
        if (!input.trim() || !activeChat || !socketRef.current) return;
        const msgData = {
            sender_id: user.userId || user.id,
            receiver_id: activeChat.user_id,
            message: input
        };
        socketRef.current.emit('send_dm', msgData);
        // Since we broadcast to ourselves too, we wait for the socket response to append, but you can also optimistically append
        setInput('');
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="messenger-overlay" onClick={onClose} />
            <div className="messenger-panel">
                <div className="messenger-header">
                    {activeChat ? (
                        <>
                            <button className="messenger-back" onClick={() => setActiveChat(null)}>⬅</button>
                            <span style={{ fontWeight: 'bold' }}>{activeChat.full_name || activeChat.username}</span>
                        </>
                    ) : (
                        <h2 style={{ margin: 0, fontSize: '20px' }}>Messages</h2>
                    )}
                    <button className="messenger-close" onClick={onClose}>&times;</button>
                </div>

                {!activeChat ? (
                    // Friends List
                    <div className="messenger-friends-list">
                        {friends.length === 0 ? (
                            <p style={{ textAlign: 'center', opacity: 0.6, marginTop: '20px' }}>No friends yet. Start connecting!</p>
                        ) : (
                            friends.map(f => (
                                <div key={f.user_id} className="messenger-friend-row" onClick={() => openChat(f)}>
                                    <div className="messenger-friend-avatar">
                                        {f.profile_picture
                                            ? <img src={f.profile_picture} alt={f.username} />
                                            : (f.full_name || f.username || '?').charAt(0).toUpperCase()
                                        }
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0 }}>{f.full_name || f.username}</h4>
                                        <span style={{ fontSize: '12px', opacity: 0.6 }}>Tap to chat</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    // Active Chat Room
                    <div className="messenger-chat-room">
                        <div className="messenger-messages">
                            {messages.map(msg => {
                                const isMine = msg.sender_id === (user.userId || user.id);
                                return (
                                    <div key={msg.id} className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
                                        {renderWithMentions(msg.message, navigate)}
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="messenger-input-area" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <MentionInput 
                                placeholder="Type a message... Use @ to mention movies!"
                                value={input}
                                onChange={(v) => setInput(v)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault() || sendMessage())}
                                className="comment-input"
                                style={{ flex: 1 }}
                            />
                            <button onClick={sendMessage} style={{ height: '44px' }}>Send</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default MessengerPanel;

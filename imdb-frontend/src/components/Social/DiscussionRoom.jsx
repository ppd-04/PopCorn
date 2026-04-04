import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { renderWithMentions } from '../../utils/MentionsUtil';
import MentionInput from './MentionInput';
import './Social.css';

const API_BASE = 'http://localhost:5000/api';

function DiscussionRoom({ user }) {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [discussion, setDiscussion] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Initial Fetch
    useEffect(() => {
        const fetchDiscussion = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                const res = await fetch(`${API_BASE}/discussions/${id}`, { headers });
                
                if (res.ok) {
                    const data = await res.json();
                    setDiscussion(data.discussion);
                    setMessages(data.messages);
                } else {
                    navigate('/social'); // fallback if unauthorized
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDiscussion();
    }, [id, navigate]);

    // Socket Connection
    useEffect(() => {
        if (!user || loading || !discussion) return;

        socketRef.current = io('http://localhost:5000');
        socketRef.current.emit('join_discussion', id);

        socketRef.current.on('receive_discussion_msg', (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, [id, user, loading, discussion]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = () => {
        if (!input.trim() || !socketRef.current || !user) return;
        
        socketRef.current.emit('send_discussion_msg', {
            discussion_id: id,
            sender_id: user.userId || user.id,
            message: input
        });
        
        setInput('');
    };

    if (loading) return <div style={{ padding: '100px', textAlign: 'center', color: 'white' }}>Joining discussion...</div>;
    if (!discussion) return <div style={{ padding: '100px', textAlign: 'center', color: 'white' }}>Discussion not found.</div>;

    const posterUrl = discussion.poster_path 
        ? `https://image.tmdb.org/t/p/w1280${discussion.poster_path}` 
        : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1280'; // fallback movie banner

    return (
        <div className="social-page" style={{ padding: 0 }}>
            {/* Banner Header */}
            <div style={{ 
                height: '350px', 
                width: '100%', 
                backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), #0a0a0a), url(${posterUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '40px 10%',
                position: 'relative'
            }}>
                <button onClick={() => navigate('/social')} style={{ position: 'absolute', top: '90px', left: '10%', background: 'rgba(0,0,0,0.5)', border: '1px solid white', color: 'white', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>
                    ⬅ Back to Social Hub
                </button>
                <h1 style={{ margin: 0, fontSize: '3rem', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,1)' }}>
                    {discussion.title}
                </h1>
                <p style={{ color: '#f5c518', fontSize: '1.2rem', textShadow: '0 2px 5px rgba(0,0,0,1)', marginTop: '10px' }}>
                    {discussion.movie_title ? `Discussion on ${discussion.movie_title}` : 'General Discussion'}
                </p>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '4px', alignSelf: 'flex-start', marginTop: '10px', color: 'white', fontSize: '12px' }}>
                    Access: {discussion.access_level.toUpperCase()}
                </span>
            </div>

            {/* Chat Area */}
            <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 350px)', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {messages.length === 0 ? (
                        <p style={{ opacity: 0.5, textAlign: 'center' }}>No messages yet. Start the conversation!</p>
                    ) : (
                        messages.map(msg => {
                            const isMine = msg.sender_id === (user.userId || user.id);
                            return (
                                <div key={msg.id} style={{ display: 'flex', gap: '15px', alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                                    {!isMine && (
                                        <img src={msg.sender_picture || 'https://via.placeholder.com/40'} alt={msg.sender_username} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                                        {!isMine && <span style={{ fontSize: '12px', opacity: 0.6, marginBottom: '5px' }}>{msg.sender_username}</span>}
                                        <div style={{
                                            background: isMine ? 'linear-gradient(45deg, #f5c518, #e6b800)' : 'rgba(255,255,255,0.1)',
                                            color: isMine ? 'black' : 'white',
                                            padding: '12px 18px',
                                            borderRadius: '20px',
                                            borderTopLeftRadius: !isMine ? '4px' : '20px',
                                            borderTopRightRadius: isMine ? '4px' : '20px',
                                            lineHeight: '1.4'
                                        }}>
                                            {renderWithMentions(msg.message, navigate)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                {/* Input Area */}
                {user ? (
                    <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10,10,15,0.95)', display: 'flex', gap: '15px' }}>
                        <MentionInput 
                            placeholder="Share your thoughts... Use @ to tag movies!"
                            value={input}
                            onChange={v => setInput(v)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault() || sendMessage())}
                            className="create-post-textarea"
                            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '25px', padding: '15px 25px', color: 'white', outline: 'none' }}
                        />
                        <button onClick={sendMessage} style={{ background: 'linear-gradient(45deg, #f5c518, #e6b800)', color: 'black', border: 'none', borderRadius: '25px', padding: '0 30px', fontWeight: 'bold', cursor: 'pointer', height: '54px' }}>
                            Send
                        </button>
                    </div>
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        You must be logged in to chat.
                    </div>
                )}
            </div>
        </div>
    );
}

export default DiscussionRoom;

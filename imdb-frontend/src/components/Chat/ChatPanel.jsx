import React, { useEffect, useRef, useState } from 'react';
import './ChatPanel.css';

const API_BASE = 'https://popcorn-s9v4.onrender.com/api';

function ChatMessage({ role, content, suggestedMovies }) {
  return (
    <div className={`chat-message ${role}`}>
      <div className="avatar">{role === 'user' ? '🧑' : '✨'}</div>
      <div className="bubble">
        <div className="chat-text">{content}</div>
        {suggestedMovies && suggestedMovies.length > 0 && (
          <div className="movie-bubbles">
            {suggestedMovies.map((movie) => (
              <a href={`/movie/${movie.id}`} key={movie.id} className="movie-bubble" target="_blank" rel="noopener noreferrer">
                <img
                  src={movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : 'https://via.placeholder.com/92x138?text=No+Poster'}
                  alt={movie.title}
                />
                <div className="bubble-info">
                  <span className="bubble-title">{movie.title}</span>
                  <span className="bubble-rating">⭐ {parseFloat(movie.vote_average || 0).toFixed(1)}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ open, onClose, theme = 'dark' }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your Movie Buddy powered by Gemini. Ask me anything about films, actors, or recommendations.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError('');

    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          system: `You are a helpful movie assistant for the PopCorn app. Keep answers concise.\r\nIf the user asks for movie recommendations based on criteria (e.g., sci-fi, horror), pick 3 or 4 exact movie titles that fit.\r\nThen, at the end of your response, output exactly one line with the following format:\r\n#GeminiMovies: Movie Title 1, Movie Title 2, Movie Title 3\r\nONLY use real movie titles. Do NOT include any SQL or code.`,
          messages: nextMessages,
          model: 'gemma-3-4b-it'
        })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Request failed');
      }
      const data = await res.json();
      const reply = data?.text || 'Sorry, I could not generate a response.';
      setMessages(m => [...m, { role: 'assistant', content: reply, suggestedMovies: data?.suggestedMovies || [] }]);
    } catch (e) {
      console.error('Chat error:', e);
      setError('Failed to reach AI. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {open && <div className="chat-overlay" onClick={onClose} />}
      <div className={`chat-panel ${open ? 'open' : ''} ${theme}`}>
        <div className="chat-header">
          <span>🎬 PopCorn AI</span>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="chat-body" ref={listRef}>
          {messages.map((m, idx) => (
            <ChatMessage key={idx} role={m.role} content={m.content} suggestedMovies={m.suggestedMovies} />
          ))}
          {loading && (
            <div className="chat-loading">Thinking…</div>
          )}
        </div>
        {error && <div className="chat-error">{error}</div>}
        <div className="chat-input">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about movies, actors, or get recommendations…"
            rows={2}
          />
          <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </>
  );
}

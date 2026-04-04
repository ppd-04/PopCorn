import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api';

export function MentionResolve({ raw, navigate }) {
  const [resolved, setResolved] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`${API_BASE}/movies/mention/resolve?text=${encodeURIComponent(raw)}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setResolved(data);
        }
      } catch (_) { /* ignore */ }
      finally {
        if (!cancelled) setDone(true);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [raw]);

  if (!done || !resolved) {
    return <>@{raw}</>;
  }

  const title = resolved.title || '';
  const tail = raw.slice(title.length); 
  const onClick = (e) => {
    e.preventDefault();
    navigate(`/movie/${resolved.id}`);
  };

  return (
    <>
      <span className="mention-link" onClick={onClick} style={{ color: '#007aff', cursor: 'pointer', fontWeight: 'bold' }}>@{title}</span>{tail}
    </>
  );
}

export function renderWithMentions(text, navigate) {
  if (!text) return null;
  const parts = [];
  const regex = /@([A-Za-z0-9][A-Za-z0-9\s:'-]*)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    const raw = match[1];
    parts.push(
      <MentionResolve key={`m-${parts.length}-${start}`} raw={raw} navigate={navigate} />
    );
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

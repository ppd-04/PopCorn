import React, { useState, useEffect } from 'react';

const API_BASE = 'https://popcorn-s9v4.onrender.com/api';

/**
 mention bubble
 */
export function MentionResolve({ title, type, id, raw, navigate }) {
  const [resolved, setResolved] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // details neya
    async function fetchDetails() {
      try {
        const url = id
          ? `${API_BASE}/movies/mention/resolve?id=${id}&type=${type}`
          : `${API_BASE}/movies/mention/resolve?text=${encodeURIComponent(raw)}`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setResolved(data);
        }
      } catch (e) {
        console.error("Mention resolve error", e);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id, type, raw]);

  const displayTitle = resolved ? (resolved.title || resolved.name) : (title || raw);
  const poster = resolved?.poster_path;
  const linkType = resolved?.type || type || 'movie';
  const linkId = resolved?.id || id;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (linkId) {
      navigate(`/${linkType}/${linkId}`);
    }
  };

  if (loading && !title) return <span>@{raw}</span>;

  // kisu na paile effect thakbe na
  if (!loading && !resolved && !id) {
    return <span>@{raw}</span>;
  }

  const posterUrl = poster ? `https://image.tmdb.org/t/p/w92${poster}` : null;

  return (
    <span className="mention-bubble" onClick={handleClick}>
      {posterUrl && <img src={posterUrl} alt="" className="mention-bubble-img" />}
      <span className="mention-title">{displayTitle}</span>
      <span className="mention-type-tag">{linkType}</span>
    </span>
  );
}

/**
 bubble banano
 */
export function renderWithMentions(text, navigate) {
  if (!text) return null;

  const parts = [];
  // Regex for NEW format: @[Title](type:id)
  const structuredRegex = /@\[([^\]]+)\]\((movie|series):(\d+)\)/g;
  // Regex for LEGACY format: @Title (stops at non-word chars except spaces/colons)
  const legacyRegex = /@([A-Za-z0-9][A-Za-z0-9\s:'-]*[A-Za-z0-9])/g;

  let lastIndex = 0;
  let match;

  const allMatches = [];

  // structured matches
  while ((match = structuredRegex.exec(text)) !== null) {
    allMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      component: <MentionResolve
        key={`struct-${match.index}`}
        title={match[1]}
        type={match[2]}
        id={match[3]}
        navigate={navigate}
      />
    });
  }

  // structure chara
  legacyRegex.lastIndex = 0;
  while ((match = legacyRegex.exec(text)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    const rawMatch = match[1];

    const isOverlapped = allMatches.some(m =>
      (start >= m.start && start < m.end) ||
      (end > m.start && end <= m.end)
    );
    if (!isOverlapped) {
      allMatches.push({
        start,
        end,
        component: <MentionResolve
          key={`leg-${start}`}
          raw={rawMatch}
          navigate={navigate}
        />
      });
    }
  }

  // position dsort
  allMatches.sort((a, b) => a.start - b.start);

  // part alada kora
  allMatches.forEach(m => {
    if (m.start > lastIndex) {
      parts.push(text.slice(lastIndex, m.start));
    }
    parts.push(m.component);
    lastIndex = m.end;
  });

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 prothomta ne
 */
export function getFirstMention(text) {
  if (!text) return null;
  const structuredRegex = /@\[([^\]]+)\]\((movie|series):(\d+)\)/;
  const match = text.match(structuredRegex);
  if (match) {
    return { title: match[1], type: match[2], id: match[3] };
  }
  return null;
}

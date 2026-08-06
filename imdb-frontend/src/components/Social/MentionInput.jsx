import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = 'https://popcorn-s9v4.onrender.com/api';

const MentionInput = ({ value, onChange, placeholder, className, onKeyDown }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUpward, setIsUpward] = useState(false);
  
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (editorRef.current) {
        const currentHtml = editorRef.current.innerHTML;
        const currentMarkdown = htmlToMarkdown(currentHtml);
        if (value !== currentMarkdown) {
            editorRef.current.innerHTML = markdownToHtml(value);
        }
    }
  }, [value]);

  const htmlToMarkdown = (html) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    temp.querySelectorAll('.mention-editor-bubble').forEach(bubble => {
        const type = bubble.getAttribute('data-type');
        const id = bubble.getAttribute('data-id');
        const title = bubble.textContent;
        bubble.outerHTML = `@[${title}](${type}:${id})`;
    });
    
    let text = temp.innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<div>/gi, '\n')
        .replace(/<\/div>/gi, '');
        
    const doc = new Array(1); 
    const span = document.createElement('span');
    span.innerHTML = text;
    return span.textContent;
  };

  const markdownToHtml = (markdown) => {
    if (!markdown) return '';
    return markdown.replace(/@\[([^\]]+)\]\((movie|series):(\d+)\)/g, (match, title, type, id) => {
        return `<span class="mention-editor-bubble" contenteditable="false" data-type="${type}" data-id="${id}">${title}</span>`;
    });
  };

  const handleInput = () => {
    const html = editorRef.current.innerHTML;
    const markdown = htmlToMarkdown(html);
    onChange(markdown);

    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || '';
    const lastAtIdx = textBefore.lastIndexOf('@');

    if (lastAtIdx !== -1) {
        const query = textBefore.slice(lastAtIdx + 1);
        if (!query.includes(' ') && !query.includes('\n')) {
            setMentionQuery(query);
            setShowSuggestions(true);
            return;
        }
    }
    setShowSuggestions(false);
    setMentionQuery('');
  };

  const insertMention = (item) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    const offset = range.startOffset;
    
    const textBefore = textNode.textContent.slice(0, offset);
    const lastAtIdx = textBefore.lastIndexOf('@');
    
    const beforeTextNode = document.createTextNode(textBefore.slice(0, lastAtIdx));
    const afterTextNode = document.createTextNode(textNode.textContent.slice(offset));
    
    const bubble = document.createElement('span');
    bubble.className = "mention-editor-bubble";
    bubble.contentEditable = "false";
    bubble.setAttribute('data-type', item.type);
    bubble.setAttribute('data-id', item.id);
    bubble.textContent = item.name;

    const parent = textNode.parentNode;
    parent.insertBefore(beforeTextNode, textNode);
    parent.insertBefore(bubble, textNode);
    parent.insertBefore(afterTextNode, textNode);
    parent.insertBefore(document.createTextNode(' '), textNode); 
    parent.removeChild(textNode);

    const newRange = document.createRange();
    newRange.setStartAfter(bubble.nextSibling);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    setShowSuggestions(false);
    setSuggestions([]);
    handleInput(); 
    editorRef.current.focus();
  };

  useEffect(() => {
    if (!showSuggestions) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/mention/search?q=${encodeURIComponent(mentionQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setActiveIndex(0);
        }
      } catch (err) {
        console.error("Mention search failed", err);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [mentionQuery, showSuggestions]);

  const handleKeyDownInternal = async (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[activeIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      } else if (e.key === ' ') {
        e.preventDefault();
        insertMention(suggestions[activeIndex]);
        return;
      }
    }

    if (e.key === 'Enter' && onKeyDown) {
        if (!showSuggestions) {
            onKeyDown(e);
        }
    }
  };

  useEffect(() => {
    if (showSuggestions && suggestions.length > 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      setIsUpward((windowHeight - rect.bottom) < 300);
    }
  }, [showSuggestions, suggestions.length]);

  return (
    <div className="mention-wrapper" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        ref={editorRef}
        className={`mention-input-editor ${className || ''}`}
        contentEditable="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDownInternal}
        onKeyUp={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') handleInput(); }}
        onClick={handleInput}
        style={{ whiteSpace: 'pre-wrap' }}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className={`mention-suggestions-container ${isUpward ? 'up' : ''}`}>
          {suggestions.map((item, idx) => (
            <div
              key={`${item.type}-${item.id}`}
              className={`mention-suggestion-item ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => insertMention(item)}
            >
              <img 
                src={item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : 'https://via.placeholder.com/92x138?text=PopCorn'} 
                alt="" 
                className="suggestion-poster"
              />
              <div className="suggestion-info">
                <span className="suggestion-name">{item.name}</span>
                <div className="suggestion-meta">
                  <span className="suggestion-type">{item.type}</span>
                  {item.release_date && <span>• {item.release_date.split('-')[0]}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;

import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = 'http://localhost:5000/api';

const MentionInput = ({ value, onChange, placeholder, className, onKeyDown }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUpward, setIsUpward] = useState(false);
  
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  // Sync external value changes (like clearing) back to the contenteditable
  useEffect(() => {
    if (editorRef.current) {
        const currentHtml = editorRef.current.innerHTML;
        // Convert the current HTML to markdown to compare with incoming value
        const currentMarkdown = htmlToMarkdown(currentHtml);
        if (value !== currentMarkdown) {
            // Only update if they differ (e.g. initial load or reset)
            editorRef.current.innerHTML = markdownToHtml(value);
        }
    }
  }, [value]);

  // Helper: Convert HTML with bubbles to markdown structured format
  const htmlToMarkdown = (html) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Replace bubbles with @[Title](type:id)
    temp.querySelectorAll('.mention-editor-bubble').forEach(bubble => {
        const type = bubble.getAttribute('data-type');
        const id = bubble.getAttribute('data-id');
        const title = bubble.textContent;
        bubble.outerHTML = `@[${title}](${type}:${id})`;
    });
    
    // Replace <br> and divs with newlines
    let text = temp.innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<div>/gi, '\n')
        .replace(/<\/div>/gi, '');
        
    // Decode HTML entities
    const doc = new Array(1); // placeholder
    const span = document.createElement('span');
    span.innerHTML = text;
    return span.textContent;
  };

  // Helper: Convert markdown to HTML with bubbles
  const markdownToHtml = (markdown) => {
    if (!markdown) return '';
    // Replace @[Title](type:id) with bubble spans
    return markdown.replace(/@\[([^\]]+)\]\((movie|series):(\d+)\)/g, (match, title, type, id) => {
        return `<span class="mention-editor-bubble" contenteditable="false" data-type="${type}" data-id="${id}">${title}</span>`;
    });
  };

  // Handle Input (Detecting @ and updating parent)
  const handleInput = () => {
    const html = editorRef.current.innerHTML;
    const markdown = htmlToMarkdown(html);
    onChange(markdown);

    // Get current selection/cursor info
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

  // Insert a bubble into the contenteditable at the cursor position
  const insertMention = (item) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    const offset = range.startOffset;
    
    const textBefore = textNode.textContent.slice(0, offset);
    const lastAtIdx = textBefore.lastIndexOf('@');
    
    // Remove the @query text
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
    parent.insertBefore(document.createTextNode(' '), textNode); // Space after bubble
    parent.removeChild(textNode);

    // Set cursor after the new space
    const newRange = document.createRange();
    newRange.setStartAfter(bubble.nextSibling);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    setShowSuggestions(false);
    setSuggestions([]);
    handleInput(); // Sync back to markdown
    editorRef.current.focus();
  };

  // Fetch suggestions
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

  // Handle keys (Arrows, Enter to select, and "Space to Resolve")
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
        // Automatic resolution on Space
        e.preventDefault();
        insertMention(suggestions[activeIndex]);
        return;
      }
    }

    if (e.key === 'Enter' && onKeyDown) {
        // Allow parent to handle enter (e.g. submit) if suggestions are closed
        if (!showSuggestions) {
            onKeyDown(e);
        }
    }
  };

  // Orientation Check
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

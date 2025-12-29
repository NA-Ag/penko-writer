import React, { useState, useEffect, useRef } from 'react';
import { htmlToMarkdown, markdownToHtml } from '../utils/markdownConverter';

interface MarkdownEditorProps {
  content: string;
  onChange: (htmlContent: string) => void;
  darkMode: boolean;
  language?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  onChange,
  darkMode,
  language = 'en-US'
}) => {
  const [markdownText, setMarkdownText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Convert HTML to Markdown when component mounts or content changes from outside
  useEffect(() => {
    const markdown = htmlToMarkdown(content);
    setMarkdownText(markdown);
  }, []);

  // Handle markdown text changes
  const handleMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMarkdown = e.target.value;
    setMarkdownText(newMarkdown);

    // Convert markdown to HTML and notify parent
    const html = markdownToHtml(newMarkdown);
    onChange(html);
  };

  // Tab key support for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newText = markdownText.substring(0, start) + '  ' + markdownText.substring(end);
      setMarkdownText(newText);

      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${
        darkMode ? 'bg-[#252526] border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Markdown Mode
          </span>
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            (GitHub Flavored Markdown)
          </span>
        </div>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            showPreview
              ? 'bg-blue-600 text-white'
              : darkMode
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* Editor/Preview */}
      <div className="flex-1 overflow-hidden">
        {showPreview ? (
          // Preview Mode
          <div
            className={`h-full overflow-auto p-8 prose max-w-none ${
              darkMode ? 'prose-invert bg-[#1e1e1e]' : 'bg-white'
            }`}
            dangerouslySetInnerHTML={{ __html: markdownToHtml(markdownText) }}
          />
        ) : (
          // Edit Mode
          <textarea
            ref={textareaRef}
            value={markdownText}
            onChange={handleMarkdownChange}
            onKeyDown={handleKeyDown}
            spellCheck={true}
            lang={language}
            className={`w-full h-full p-8 font-mono text-sm resize-none focus:outline-none ${
              darkMode
                ? 'bg-[#1e1e1e] text-gray-300 placeholder-gray-600'
                : 'bg-white text-gray-900 placeholder-gray-400'
            }`}
            placeholder="# Start writing in Markdown...

## Headers
Use # for h1, ## for h2, etc.

**Bold text** and *italic text*

- Bullet list
- Another item

1. Numbered list
2. Another item

[Link text](https://example.com)
![Image alt](image-url.jpg)

`inline code` and code blocks:

```javascript
const hello = 'world';
```

> Blockquotes start with >

---

Tables:
| Column 1 | Column 2 |
| -------- | -------- |
| Data 1   | Data 2   |"
          />
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { NodeViewContent, NodeViewWrapper, NodeViewProps } from '@tiptap/react';

/** Same look as the original inserted code-block widget, but live and editable. */
export const CodeBlockView: React.FC<NodeViewProps> = ({ node }) => {
  const [copied, setCopied] = useState(false);
  const dark = node.attrs.theme !== 'light';
  const lines = Math.max(1, node.textContent.split('\n').length);

  const palette = dark
    ? { bg: '#2d2d2d', header: '#1e1e1e', border: '#404040', text: '#d4d4d4', label: '#888', gutter: '#6e7681', btn: '#404040', btnText: '#fff' }
    : { bg: '#f6f8fa', header: '#eaeef2', border: '#d0d7de', text: '#24292f', label: '#57606a', gutter: '#8c959f', btn: '#d0d7de', btnText: '#24292f' };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <NodeViewWrapper
      className={`code-block-container ${dark ? 'code-theme-dark' : 'code-theme-light'}`}
      style={{ margin: '20px 0', borderRadius: 8, overflow: 'hidden', background: palette.bg, fontFamily: "'Courier New', monospace" }}
    >
      <div
        contentEditable={false}
        className="code-block-header"
        style={{ background: palette.header, padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${palette.border}`, userSelect: 'none' }}
      >
        <span style={{ color: palette.label, fontSize: 12, textTransform: 'uppercase' }}>{node.attrs.language}</span>
        <button
          type="button"
          onClick={copy}
          style={{ background: palette.btn, color: palette.btnText, border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="code-block-content" style={{ display: 'flex', overflowX: 'auto' }}>
        {node.attrs.lineNumbers && (
          <div
            contentEditable={false}
            className="line-numbers"
            style={{ background: palette.header, padding: '12px 8px', textAlign: 'right', color: palette.gutter, userSelect: 'none', minWidth: 40, borderRight: `1px solid ${palette.border}`, fontFamily: "'Courier New', monospace" }}
          >
            {Array.from({ length: lines }, (_, i) => (
              <div key={i} style={{ lineHeight: 1.6, fontSize: 14 }}>
                {i + 1}
              </div>
            ))}
          </div>
        )}
        <pre style={{ margin: 0, padding: '12px 16px', flex: 1, overflowX: 'auto', background: 'transparent' }}>
          <NodeViewContent
            as={'code' as any}
            className={`language-${node.attrs.language}`}
            style={{ color: palette.text, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre', display: 'block', fontFamily: "'Courier New', monospace", background: 'transparent', textShadow: dark ? undefined : 'none' }}
          />
        </pre>
      </div>
    </NodeViewWrapper>
  );
};

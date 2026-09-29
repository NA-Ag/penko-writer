import { describe, it, expect } from 'vitest';
import { sanitizeHtml, normalizeLegacyHtml, safeUrl, escapeHtml } from '../../editor/sanitize';

describe('sanitizeHtml', () => {
  it('removes event handlers and scripts', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">hi</p><img src=x onerror="alert(1)"><script>alert(1)</script>');
    expect(out).not.toMatch(/onclick|onerror|<script/i);
    expect(out).toContain('<p>hi</p>');
  });
  it('drops javascript: links but keeps safe ones', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    expect(sanitizeHtml('<a href="https://example.com">x</a>')).toContain('https://example.com');
  });
  it('keeps inline styles and data attributes used by templates', () => {
    const out = sanitizeHtml('<div style="color: red" data-screenplay-type="action">t</div>');
    expect(out).toContain('style="color: red"');
    expect(out).toContain('data-screenplay-type="action"');
  });
  it('keeps base64 images', () => {
    expect(sanitizeHtml('<img src="data:image/png;base64,AAAA">')).toContain('data:image/png;base64,AAAA');
  });
  it('removes style tags and iframes', () => {
    expect(sanitizeHtml('<style>body{display:none}</style><iframe src="https://x"></iframe><p>a</p>')).toBe('<p>a</p>');
  });
});

describe('normalizeLegacyHtml', () => {
  it('converts <font> to spans and unwraps resize wrappers', () => {
    const out = normalizeLegacyHtml('<font face="Arial" color="#f00">x</font><div class="img-resize-wrapper"><img src="a.png" class="selected-img"><div class="img-resize-handle"></div></div>');
    expect(out).toContain('font-family: Arial');
    expect(out).not.toContain('img-resize');
    expect(out).not.toContain('selected-img');
  });
  it('strips fake pagination margins from top-level blocks', () => {
    expect(normalizeLegacyHtml('<p style="margin-top: 300px">a</p>')).toBe('<p>a</p>');
  });
});

describe('safeUrl / escapeHtml', () => {
  it('rejects dangerous protocols and prefixes bare domains', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('example.com')).toBe('https://example.com');
    expect(safeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeUrl('#section')).toBe('#section');
  });
  it('escapes html', () => {
    expect(escapeHtml('<a "b">')).toBe('&lt;a &quot;b&quot;&gt;');
  });
});

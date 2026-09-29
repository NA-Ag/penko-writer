import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { createExtensions } from '../../editor/extensions';
import { prepareHtmlForEditor } from '../../editor/sanitize';
import { TEMPLATES } from '../../utils/templates';
import { splitIntoSlides, slideNeedsLightSurface } from '../../utils/slides';

const text = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').replace(/\s+/g, '');
};

describe('splitIntoSlides', () => {
  it('splits on top-level H1/H2', () => {
    const s = splitIntoSlides('<h1>A</h1><p>a</p><h2>B</h2><p>b</p>');
    expect(s).toHaveLength(2);
    expect(s[1]).toContain('<h2>B</h2>');
  });

  it('flattens wrapper containers and keeps their styles', () => {
    const s = splitIntoSlides('<div style="color: red"><h1>A</h1><p>a</p><section><h2>B</h2><p>b</p></section></div>');
    expect(s).toHaveLength(2);
    expect(s[0]).toMatch(/^<div style="color: red"><h1>A<\/h1>/);
    expect(s[1]).toContain('style="color: red"');
    expect(text(s.join(''))).toBe('AaBb');
  });

  it('keeps a title and subtitle together', () => {
    const s = splitIntoSlides('<h1>T</h1><h2>Sub</h2><p>x</p><h2>Next</h2><p>y</p>');
    expect(s).toHaveLength(2);
  });

  it('falls back to H3 when H1/H2 give one slide', () => {
    const s = splitIntoSlides('<div><h1>T</h1><p>i</p><h3>One</h3><p>1</p><h3>Two</h3><p>2</p></div>');
    expect(s.length).toBe(3);
  });

  it('returns no slides for an empty doc and sanitizes', () => {
    expect(splitIntoSlides('<p></p>')).toEqual([]);
    expect(splitIntoSlides('<h1>x</h1><img src=x onerror="alert(1)">').join('')).not.toContain('onerror');
  });

  it('gives every template (after the editor) several slides without losing text', () => {
    for (const tpl of TEMPLATES) {
      if (!text(tpl.content)) continue;
      const ed = new Editor({ extensions: createExtensions({ paginate: false }), content: prepareHtmlForEditor(tpl.content) });
      const html = ed.getHTML();
      ed.destroy();
      const slides = splitIntoSlides(html);
      expect(text(slides.join('')), tpl.name).toBe(text(html));
      if (['Project Proposal', 'Business Proposal', 'Thesis/Dissertation', 'User Manual', 'Meeting Minutes'].includes(tpl.name)) {
        expect(slides.length, tpl.name).toBeGreaterThan(2);
      }
    }
  }, 30_000); // loads all 26 templates through a headless editor
});

describe('slideNeedsLightSurface', () => {
  it('detects dark explicit text colours only', () => {
    expect(slideNeedsLightSurface('<div style="color: #333">x</div>')).toBe(true);
    expect(slideNeedsLightSurface('<div style="background-color: #000; color: #fff">x</div>')).toBe(false);
    expect(slideNeedsLightSurface('<p>x</p>')).toBe(false);
  });
});

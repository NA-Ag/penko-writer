import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { createExtensions } from '../../editor/extensions';
import { prepareHtmlForEditor } from '../../editor/sanitize';
import { TEMPLATES } from '../../utils/templates';

const textOf = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g, '');
};

const styleDecls = (html: string) => {
  const div = document.createElement('div');
  // Round-trip through the DOM style parser so equivalent values compare equal
  div.innerHTML = html;
  div.querySelectorAll('[style]').forEach(el => el.setAttribute('style', (el as HTMLElement).style.cssText));
  const set = new Set<string>();
  div.querySelectorAll('[style]').forEach(el => {
    (el.getAttribute('style') || '')
      .split(';')
      .map(s => s.trim().replace(/\s*:\s*/, ': ').toLowerCase())
      .filter(Boolean)
      .forEach(d => set.add(d));
  });
  return set;
};

describe('templates survive the Tiptap schema', () => {
  for (const tpl of TEMPLATES) {
    it(`${tpl.id}: keeps all text and inline styles`, () => {
      const editor = new Editor({ extensions: createExtensions({ paginate: false }), content: prepareHtmlForEditor(tpl.content) });
      const out = editor.getHTML();
      expect(textOf(out)).toBe(textOf(tpl.content));
      const before = styleDecls(tpl.content);
      const after = styleDecls(out);
      // Expected normalisations: page-break divs become page-break nodes, bold
      // spans become <strong>, pixel image sizes become width/height attributes.
      const lost = [...before].filter(
        d => !after.has(d) && !/^(text-align|min-width|page-break-before|font-weight: bold|(width|height): \d+px|margin: 20px 0px)/.test(d),
      );
      expect(lost).toEqual([]);
      editor.destroy();
    });
  }
});

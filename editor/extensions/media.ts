import Image from '@tiptap/extension-image';
import { omitStyle, parseStyle } from './styleUtils';

/**
 * Inline image that keeps legacy inline styles (percentage widths, rotation,
 * borders, float positions) while using Tiptap's resizable node view, so the
 * resize handles never leak into saved HTML.
 */
export const PenkoImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const attr = el.getAttribute('width');
          if (attr && /^\d+(\.\d+)?$/.test(attr)) return parseFloat(attr);
          const w = parseStyle(el.getAttribute('style')).width;
          if (w && /px$/.test(w)) return parseFloat(w);
          return null;
        },
        renderHTML: (attrs: Record<string, any>) => (attrs.width ? { width: Math.round(attrs.width) } : {}),
      },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const attr = el.getAttribute('height');
          if (attr && /^\d+(\.\d+)?$/.test(attr)) return parseFloat(attr);
          const h = parseStyle(el.getAttribute('style')).height;
          if (h && /px$/.test(h)) return parseFloat(h);
          return null;
        },
        renderHTML: (attrs: Record<string, any>) => (attrs.height ? { height: Math.round(attrs.height) } : {}),
      },
      style: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const style = parseStyle(el.getAttribute('style'));
          // px sizes become attributes (see above); keep % / auto in style
          const drop: string[] = [];
          if (style.width && /px$/.test(style.width)) drop.push('width');
          if (style.height && /px$/.test(style.height)) drop.push('height');
          return omitStyle(el.getAttribute('style'), drop);
        },
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.style) return {};
          // Once the user resizes with the handles, pixel attributes win.
          const style = attrs.width ? omitStyle(attrs.style, ['width', 'height']) : attrs.style;
          return style ? { style } : {};
        },
      },
      class: {
        default: null,
        parseHTML: (el: HTMLElement) => (el.getAttribute('class') || '').replace(/\bselected-img\b/g, '').trim() || null,
      },
      'data-caption': {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-caption'),
      },
    };
  },
}).configure({
  inline: true,
  allowBase64: true,
  resize: {
    enabled: true,
    directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right'] as any,
    minWidth: 50,
    minHeight: 50,
    alwaysPreserveAspectRatio: true,
  },
});

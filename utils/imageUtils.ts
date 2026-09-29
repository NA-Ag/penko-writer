/**
 * Image helpers.
 *
 * The style helpers are pure: they read an image node's inline `style`
 * attribute and return a *patch* (`{ property: value | null }`) that the
 * caller applies through `updateSelectedImage({ style })`, so every change is
 * a normal (saved, undoable) editor transaction. Nothing here touches the
 * editor DOM.
 */
import { parseStyle } from '../editor/extensions/styleUtils';

export type ImagePositionMode = 'inline' | 'float-left' | 'float-right' | 'centered';
export type ImageEffect = 'none' | 'grayscale' | 'sepia' | 'brightness' | 'contrast' | 'blur';
export type ImageBorderStyle = 'none' | 'thin' | 'medium' | 'thick' | 'rounded';
export type ImageShadowStyle = 'none' | 'small' | 'medium' | 'large';
export type StylePatch = Record<string, string | null>;

/* ------------------------------------------------------------------ */
/* Position                                                            */
/* ------------------------------------------------------------------ */

const POSITION_RESET: StylePatch = {
  float: null,
  display: null,
  margin: null,
  'margin-left': null,
  'margin-right': null,
  'margin-top': null,
  'margin-bottom': null,
  'vertical-align': null,
  position: null,
  top: null,
  left: null,
};

export const positionPatch = (mode: ImagePositionMode): StylePatch => {
  switch (mode) {
    case 'float-left':
      return { ...POSITION_RESET, float: 'left', margin: '0 16px 8px 0' };
    case 'float-right':
      return { ...POSITION_RESET, float: 'right', margin: '0 0 8px 16px' };
    case 'centered':
      return { ...POSITION_RESET, display: 'block', margin: '0 auto' };
    case 'inline':
    default:
      return { ...POSITION_RESET };
  }
};

export const getPositionMode = (style: string | null | undefined): ImagePositionMode => {
  const s = parseStyle(style);
  if (s.float === 'left') return 'float-left';
  if (s.float === 'right') return 'float-right';
  if (s.display === 'block' && /auto/.test(s.margin || `${s['margin-left'] || ''} ${s['margin-right'] || ''}`)) return 'centered';
  return 'inline';
};

/* ------------------------------------------------------------------ */
/* Rotation                                                            */
/* ------------------------------------------------------------------ */

export const getRotation = (style: string | null | undefined): number => {
  const m = (parseStyle(style).transform || '').match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
  return m ? parseFloat(m[1]) : 0;
};

/** Rotate by `degrees` relative to the current rotation (keeps other transforms). */
export const rotatePatch = (style: string | null | undefined, degrees: number): StylePatch => {
  const next = (((getRotation(style) + degrees) % 360) + 360) % 360;
  const other = (parseStyle(style).transform || '').replace(/rotate\([^)]*\)/g, '').trim();
  const transform = [other, next ? `rotate(${next}deg)` : ''].filter(Boolean).join(' ');
  return { transform: transform || null };
};

/* ------------------------------------------------------------------ */
/* Effects (CSS filters)                                               */
/* ------------------------------------------------------------------ */

export const effectPatch = (effect: ImageEffect, value = 100): StylePatch => {
  switch (effect) {
    case 'grayscale':
      return { filter: 'grayscale(100%)' };
    case 'sepia':
      return { filter: 'sepia(100%)' };
    case 'brightness':
      return { filter: `brightness(${value}%)` };
    case 'contrast':
      return { filter: `contrast(${value}%)` };
    case 'blur':
      return { filter: `blur(${value}px)` };
    case 'none':
    default:
      return { filter: null };
  }
};

export const getEffect = (style: string | null | undefined): { effect: ImageEffect; value: number } => {
  const f = parseStyle(style).filter || '';
  const m = f.match(/^(grayscale|sepia|brightness|contrast|blur)\((-?\d+(?:\.\d+)?)(%|px)?\)/);
  if (!m) return { effect: 'none', value: 100 };
  return { effect: m[1] as ImageEffect, value: parseFloat(m[2]) };
};

/* ------------------------------------------------------------------ */
/* Border / shadow                                                     */
/* ------------------------------------------------------------------ */

/**
 * Border presets shared by the ribbon's Image tab and the floating image
 * toolbar. Colours are fixed (not theme-dependent): they are saved in the document.
 */
export const borderPatch = (style: ImageBorderStyle): StylePatch => {
  switch (style) {
    case 'thin':
      return { border: '1px solid #cccccc', 'border-radius': '0', padding: '2px' };
    case 'medium':
      return { border: '3px solid #999999', 'border-radius': '0', padding: '4px' };
    case 'thick':
      return { border: '6px solid #666666', 'border-radius': '0', padding: '6px' };
    case 'rounded':
      return { border: '2px solid #999999', 'border-radius': '12px', padding: '4px' };
    case 'none':
    default:
      return { border: null, 'border-radius': null, padding: null };
  }
};

export const shadowPatch = (style: ImageShadowStyle): StylePatch => {
  switch (style) {
    case 'small':
      return { 'box-shadow': '0 2px 4px rgba(0, 0, 0, 0.1)' };
    case 'medium':
      return { 'box-shadow': '0 4px 8px rgba(0, 0, 0, 0.15)' };
    case 'large':
      return { 'box-shadow': '0 8px 16px rgba(0, 0, 0, 0.2)' };
    case 'none':
    default:
      return { 'box-shadow': null };
  }
};

/* ------------------------------------------------------------------ */
/* Metadata                                                            */
/* ------------------------------------------------------------------ */

export interface ImageInfo {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  positionMode: ImagePositionMode;
  effect: ImageEffect;
  rotation: number;
}

export const getImageInfo = (attrs: Record<string, any>): ImageInfo => ({
  src: attrs.src || '',
  alt: attrs.alt || '',
  width: typeof attrs.width === 'number' ? attrs.width : null,
  height: typeof attrs.height === 'number' ? attrs.height : null,
  positionMode: getPositionMode(attrs.style),
  effect: getEffect(attrs.style).effect,
  rotation: getRotation(attrs.style),
});

/** MIME type of a data URL ('' for other URLs). */
export const getDataUrlMime = (src: string): string => {
  const m = /^data:([^;,]+)[;,]/i.exec(src || '');
  return m ? m[1].toLowerCase() : '';
};

/** Approximate decoded size in bytes of a base64 data URL (0 for other URLs). */
export const estimateDataUrlBytes = (src: string): number => {
  if (!/^data:/i.test(src || '')) return 0;
  const comma = src.indexOf(',');
  const payload = comma === -1 ? '' : src.slice(comma + 1);
  if (!/;base64,/i.test(src.slice(0, comma + 1))) return payload.length;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
};

export const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/* ------------------------------------------------------------------ */
/* Upload optimisation                                                 */
/* ------------------------------------------------------------------ */

/** Formats that must never be re-encoded (animation / vector would be lost). */
const NEVER_COMPRESS = ['image/gif', 'image/svg+xml', 'image/apng', 'image/x-icon', 'image/vnd.microsoft.icon'];

/**
 * Only large raster photos are worth re-encoding. GIF (animation) and SVG
 * (vector) are always kept as they are.
 */
export function shouldCompressImage(dataUrl: string, maxSizeKB: number = 1024): boolean {
  const mime = getDataUrlMime(dataUrl);
  if (!mime || NEVER_COMPRESS.includes(mime) || !mime.startsWith('image/')) return false;
  return estimateDataUrlBytes(dataUrl) / 1024 > maxSizeKB;
}

/** Target size that fits within max bounds while keeping the aspect ratio. */
export const fitWithin = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  if (width <= maxWidth && height <= maxHeight) return { width, height };
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/** True when any pixel of RGBA data is not fully opaque. */
export const hasTransparency = (rgba: ArrayLike<number>): boolean => {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 255) return true;
  return false;
};

/**
 * Downscale / re-encode a large image. Images with transparency stay PNG
 * (JPEG would turn transparent areas black); opaque ones become JPEG. If the
 * result isn't smaller, the original is returned unchanged.
 */
export async function compressImage(dataUrl: string, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.85): Promise<string> {
  const mime = getDataUrlMime(dataUrl);
  if (NEVER_COMPRESS.includes(mime)) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to load image for compression'));
    el.src = dataUrl;
  });
  const { width, height } = fitWithin(img.naturalWidth || img.width, img.naturalHeight || img.height, maxWidth, maxHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  let transparent = false;
  if (mime !== 'image/jpeg') {
    try {
      transparent = hasTransparency(ctx.getImageData(0, 0, width, height).data);
    } catch {
      transparent = true; // can't inspect: be safe
    }
  }
  const out = transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
  return out.length < dataUrl.length ? out : dataUrl;
}

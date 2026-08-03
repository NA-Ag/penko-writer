/**
 * Image Positioning and Manipulation Utilities
 * Handles positioning modes, effects, optimization, and metadata
 */

export type ImagePositionMode = 'inline' | 'float-left' | 'float-right' | 'centered' | 'absolute';
export type ImageEffect = 'none' | 'grayscale' | 'sepia' | 'brightness' | 'contrast' | 'blur';

export interface ImageMetadata {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  positionMode: ImagePositionMode;
  effect?: ImageEffect;
  effectValue?: number; // For brightness/contrast/blur (0-200 for brightness/contrast, 0-10 for blur)
  rotation?: number;
  border?: string;
  aspectRatioLocked: boolean;
  absolutePosition?: { top: number; left: number };
}

/**
 * Apply positioning mode to an image element
 */
export function applyImagePosition(img: HTMLImageElement, mode: ImagePositionMode) {
  // Remove all positioning classes
  img.classList.remove('img-inline', 'img-float-left', 'img-float-right', 'img-centered', 'img-absolute');

  // Clear inline styles that might interfere
  img.style.float = '';
  img.style.display = '';
  img.style.margin = '';
  img.style.position = '';

  // Find or create wrapper div
  let wrapper = img.parentElement;
  if (!wrapper || !wrapper.hasAttribute('data-image-wrapper')) {
    wrapper = document.createElement('div');
    wrapper.setAttribute('data-image-wrapper', 'true');
    img.parentElement?.insertBefore(wrapper, img);
    wrapper.appendChild(img);
  }

  // Clear wrapper styles
  wrapper.style.textAlign = '';
  wrapper.style.display = '';
  wrapper.style.margin = '';

  switch (mode) {
    case 'inline':
      img.classList.add('img-inline');
      img.style.display = 'inline';
      img.style.verticalAlign = 'middle';
      break;

    case 'float-left':
      img.classList.add('img-float-left');
      img.style.float = 'left';
      img.style.marginRight = '16px';
      img.style.marginBottom = '8px';
      break;

    case 'float-right':
      img.classList.add('img-float-right');
      img.style.float = 'right';
      img.style.marginLeft = '16px';
      img.style.marginBottom = '8px';
      break;

    case 'centered':
      img.classList.add('img-centered');
      wrapper.style.textAlign = 'center';
      wrapper.style.display = 'block';
      wrapper.style.margin = '16px 0';
      img.style.display = 'inline-block';
      break;

    case 'absolute':
      img.classList.add('img-absolute');
      img.style.position = 'absolute';
      // Get current position or use default
      const currentTop = img.getAttribute('data-abs-top') || '100';
      const currentLeft = img.getAttribute('data-abs-left') || '100';
      img.style.top = currentTop + 'px';
      img.style.left = currentLeft + 'px';
      break;
  }

  img.setAttribute('data-position-mode', mode);
}

/**
 * Apply visual effects to an image
 */
export function applyImageEffect(img: HTMLImageElement, effect: ImageEffect, value: number = 100) {
  const filters: string[] = [];

  // Preserve rotation if it exists
  const rotation = img.getAttribute('data-rotation') || '0';
  let transform = rotation !== '0' ? `rotate(${rotation}deg)` : '';

  switch (effect) {
    case 'none':
      img.style.filter = '';
      break;

    case 'grayscale':
      filters.push('grayscale(100%)');
      break;

    case 'sepia':
      filters.push('sepia(100%)');
      break;

    case 'brightness':
      // value: 0-200, default 100 (normal)
      filters.push(`brightness(${value}%)`);
      break;

    case 'contrast':
      // value: 0-200, default 100 (normal)
      filters.push(`contrast(${value}%)`);
      break;

    case 'blur':
      // value: 0-10, in pixels
      filters.push(`blur(${value}px)`);
      break;
  }

  if (filters.length > 0) {
    img.style.filter = filters.join(' ');
  }

  if (transform) {
    img.style.transform = transform;
  }

  img.setAttribute('data-effect', effect);
  if (value !== 100) {
    img.setAttribute('data-effect-value', value.toString());
  }
}

/**
 * Resize image while maintaining aspect ratio
 */
export function resizeImage(
  img: HTMLImageElement,
  width?: number,
  height?: number,
  maintainAspectRatio: boolean = true
) {
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  const aspectRatio = naturalWidth / naturalHeight;

  if (maintainAspectRatio) {
    if (width && !height) {
      img.style.width = width + 'px';
      img.style.height = 'auto';
    } else if (height && !width) {
      img.style.height = height + 'px';
      img.style.width = 'auto';
    } else if (width && height) {
      // Use width and calculate height
      img.style.width = width + 'px';
      img.style.height = (width / aspectRatio) + 'px';
    }
  } else {
    if (width) img.style.width = width + 'px';
    if (height) img.style.height = height + 'px';
  }

  img.setAttribute('data-aspect-locked', maintainAspectRatio ? 'true' : 'false');
}

/**
 * Resize image by percentage of original size
 */
export function resizeImageByPercent(img: HTMLImageElement, percent: number) {
  const naturalWidth = img.naturalWidth;
  const newWidth = (naturalWidth * percent) / 100;
  resizeImage(img, newWidth, undefined, true);
}

/**
 * Get all images in the editor
 */
export function getAllImages(editorElement: HTMLElement): HTMLImageElement[] {
  return Array.from(editorElement.querySelectorAll('img'));
}

/**
 * Extract image metadata
 */
export function getImageMetadata(img: HTMLImageElement): ImageMetadata {
  const positionMode = (img.getAttribute('data-position-mode') || 'inline') as ImagePositionMode;
  const effect = (img.getAttribute('data-effect') || 'none') as ImageEffect;
  const effectValue = parseInt(img.getAttribute('data-effect-value') || '100');
  const rotation = parseInt(img.getAttribute('data-rotation') || '0');
  const aspectRatioLocked = img.getAttribute('data-aspect-locked') !== 'false';

  const absolutePosition = positionMode === 'absolute' ? {
    top: parseInt(img.getAttribute('data-abs-top') || '0'),
    left: parseInt(img.getAttribute('data-abs-left') || '0')
  } : undefined;

  return {
    src: img.src,
    alt: img.alt || '',
    width: img.width,
    height: img.height,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    positionMode,
    effect,
    effectValue,
    rotation,
    border: img.style.border,
    aspectRatioLocked,
    absolutePosition
  };
}

/**
 * Set image alt text for accessibility
 */
export function setImageAltText(img: HTMLImageElement, altText: string) {
  img.alt = altText;
  img.setAttribute('title', altText);
}

/**
 * Compress/optimize image data
 * Returns compressed base64 data URL
 */
export async function compressImage(
  dataUrl: string,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;

        if (width > height) {
          width = maxWidth;
          height = Math.round(width / aspectRatio);
        } else {
          height = maxHeight;
          width = Math.round(height * aspectRatio);
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed data URL
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    img.src = dataUrl;
  });
}

/**
 * Check if image is larger than threshold and needs compression
 */
export function shouldCompressImage(dataUrl: string, maxSizeKB: number = 1024): boolean {
  // Base64 encoded data is ~33% larger than actual file size
  // So we multiply by 0.75 to get approximate file size
  const sizeInBytes = (dataUrl.length * 0.75);
  const sizeInKB = sizeInBytes / 1024;

  return sizeInKB > maxSizeKB;
}

/**
 * Make image draggable for absolute positioning
 */
export function makeImageDraggable(img: HTMLImageElement, onPositionChange?: (top: number, left: number) => void) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialTop = 0;
  let initialLeft = 0;

  const handleMouseDown = (e: MouseEvent) => {
    if (img.getAttribute('data-position-mode') !== 'absolute') return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = img.getBoundingClientRect();
    const parentRect = img.offsetParent?.getBoundingClientRect();

    if (parentRect) {
      initialTop = rect.top - parentRect.top;
      initialLeft = rect.left - parentRect.left;
    }

    img.style.cursor = 'grabbing';
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    const newTop = initialTop + deltaY;
    const newLeft = initialLeft + deltaX;

    img.style.top = newTop + 'px';
    img.style.left = newLeft + 'px';

    img.setAttribute('data-abs-top', newTop.toString());
    img.setAttribute('data-abs-left', newLeft.toString());

    if (onPositionChange) {
      onPositionChange(newTop, newLeft);
    }
  };

  const handleMouseUp = () => {
    isDragging = false;
    img.style.cursor = 'grab';
  };

  img.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Set cursor style for absolute images
  if (img.getAttribute('data-position-mode') === 'absolute') {
    img.style.cursor = 'grab';
  }

  // Return cleanup function
  return () => {
    img.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}

/**
 * Border styles
 */
export type ImageBorderStyle = 'none' | 'thin' | 'medium' | 'thick';

export function applyImageBorder(img: HTMLImageElement, style: ImageBorderStyle) {
  switch (style) {
    case 'none':
      img.style.border = '';
      break;
    case 'thin':
      img.style.border = '1px solid #ccc';
      break;
    case 'medium':
      img.style.border = '3px solid #999';
      break;
    case 'thick':
      img.style.border = '6px solid #666';
      break;
  }
  img.setAttribute('data-border', style);
}

/**
 * Shadow styles
 */
export type ImageShadowStyle = 'none' | 'small' | 'medium' | 'large';

export function applyImageShadow(img: HTMLImageElement, style: ImageShadowStyle) {
  switch (style) {
    case 'none':
      img.style.boxShadow = '';
      break;
    case 'small':
      img.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
      break;
    case 'medium':
      img.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
      break;
    case 'large':
      img.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
      break;
  }
  img.setAttribute('data-shadow', style);
}

/**
 * Caption functionality
 */
export function addImageCaption(img: HTMLImageElement, captionText: string) {
  // Find or create wrapper
  let wrapper = img.parentElement;
  if (!wrapper || !wrapper.hasAttribute('data-image-wrapper')) {
    wrapper = document.createElement('div');
    wrapper.setAttribute('data-image-wrapper', 'true');
    img.parentElement?.insertBefore(wrapper, img);
    wrapper.appendChild(img);
  }

  // Remove existing caption if any
  const existingCaption = wrapper.querySelector('[data-image-caption]');
  if (existingCaption) {
    existingCaption.remove();
  }

  // Add new caption if text provided
  if (captionText.trim()) {
    const caption = document.createElement('div');
    caption.setAttribute('data-image-caption', 'true');
    caption.textContent = captionText;
    caption.style.textAlign = 'center';
    caption.style.fontSize = '0.9em';
    caption.style.color = '#666';
    caption.style.fontStyle = 'italic';
    caption.style.marginTop = '8px';
    wrapper.appendChild(caption);
  }

  img.setAttribute('data-caption', captionText);
}

/**
 * Get image caption text
 */
export function getImageCaption(img: HTMLImageElement): string {
  return img.getAttribute('data-caption') || '';
}

/**
 * Rotate image
 */
export function rotateImage(img: HTMLImageElement, degrees: number) {
  const currentRotation = parseInt(img.getAttribute('data-rotation') || '0');
  const newRotation = (currentRotation + degrees) % 360;

  // Preserve existing filters
  const currentFilter = img.style.filter || '';

  img.style.transform = `rotate(${newRotation}deg)`;
  img.setAttribute('data-rotation', newRotation.toString());
}

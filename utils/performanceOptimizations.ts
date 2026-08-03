/**
 * Performance Optimization Utilities for Penko Writer
 *
 * These utilities help improve app performance through:
 * - Debouncing frequent operations
 * - Throttling expensive calculations
 * - Lazy loading components
 * - Memoization helpers
 */

/**
 * Debounce function - delays execution until after wait time has elapsed since last call
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per wait period
 * @param func Function to throttle
 * @param wait Wait time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), wait);
    }
  };
}

/**
 * Lazy load image with loading state
 * @param src Image source URL
 * @param placeholder Placeholder image while loading
 * @returns Object with src, loading state, and error
 */
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = React.useState(placeholder || '');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setLoading(false);
    };
    img.onerror = () => {
      setError(true);
      setLoading(false);
    };
    img.src = src;
  }, [src]);

  return { src: imageSrc, loading, error };
}

import React from 'react';

/**
 * Check if an element is in viewport
 * @param element HTML element to check
 * @returns True if element is in viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Measure performance of a function
 * @param name Performance mark name
 * @param func Function to measure
 * @returns Function result
 */
export async function measurePerformance<T>(
  name: string,
  func: () => T | Promise<T>
): Promise<T> {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;

  performance.mark(startMark);
  const result = await func();
  performance.mark(endMark);

  try {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name)[0];
    console.log(`Performance: ${name} took ${measure.duration.toFixed(2)}ms`);
  } catch (e) {
    console.warn('Performance measurement failed:', e);
  }

  // Cleanup
  performance.clearMarks(startMark);
  performance.clearMarks(endMark);
  performance.clearMeasures(name);

  return result;
}

/**
 * Request idle callback wrapper with fallback
 * @param callback Callback to execute during idle time
 * @param options RequestIdleCallback options
 */
export function requestIdleCallback(
  callback: () => void,
  options?: { timeout?: number }
): number {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }
  // Fallback for browsers that don't support requestIdleCallback
  return setTimeout(callback, 1) as unknown as number;
}

/**
 * Cancel idle callback with fallback
 * @param id Callback ID to cancel
 */
export function cancelIdleCallback(id: number): void {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Batch DOM updates for better performance
 * @param updates Array of functions that update the DOM
 */
export function batchDOMUpdates(updates: (() => void)[]): void {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
}

/**
 * Compress string data for localStorage
 * @param data String to compress
 * @returns Compressed string
 */
export function compressForStorage(data: string): string {
  try {
    // Simple run-length encoding for repeated characters
    return data.replace(/(.)\1{2,}/g, (match, char) => {
      return `${char}${match.length}`;
    });
  } catch (e) {
    return data; // Return original if compression fails
  }
}

/**
 * Decompress string data from localStorage
 * @param data Compressed string
 * @returns Decompressed string
 */
export function decompressFromStorage(data: string): string {
  try {
    return data.replace(/(.)\d+/g, (match, char, num) => {
      return char.repeat(parseInt(num) || 1);
    });
  } catch (e) {
    return data; // Return original if decompression fails
  }
}

/**
 * Calculate storage usage
 * @returns Object with used and available storage in bytes
 */
export function getStorageStats(): { used: number; available: number } {
  let used = 0;

  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage[key].length + key.length;
    }
  }

  const available = 10 * 1024 * 1024 - used; // Approximate 10MB limit

  return { used, available };
}

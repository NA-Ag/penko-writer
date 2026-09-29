/**
 * Penko mascot — full body pixel character (16x16 animation frames).
 * Rendered to a single pixelated <canvas>; the animation runs outside React
 * (no re-renders), pauses while the tab is hidden and honours
 * prefers-reduced-motion.
 */

import React from 'react';
import { PENKO_ANIMATIONS, AnimationName } from '../penko_anim';

export type PenkoIconType = 'custom' | 'lurch' | 'writer';
export type PenkoPose = AnimationName;

interface PenkoIconProps {
  type: PenkoIconType;
  size?: number;
  className?: string;
  pose?: PenkoPose;
}

// Color palette: 0=transparent, 1=black, 2=white, 3=blue-gray, 4=orange,
// 5=red, 6=yellow/gold, 7=blue, 8=green, 9=purple, 10=pink, 11=brown, 12=cyan, 13=gray
const COLORS: Record<number, string | null> = {
  0: null,
  1: '#111',    // Outline/Black
  2: '#fff',    // Belly/Eyes/White
  3: '#64748b', // Slate-500 (Body)
  4: '#f97316', // Orange-500 (Beak/Feet)
  5: '#ef4444', // Red
  6: '#fbbf24', // Amber/Yellow
  7: '#3b82f6', // Blue
  8: '#22c55e', // Green
  9: '#a855f7', // Purple
  10: '#ec4899', // Pink
  11: '#8B4513', // Brown
  12: '#06b6d4', // Cyan
  13: '#9ca3af', // Light Gray
};

/** Applies a costume to one animation frame (returns a new matrix). */
export const applyCostume = (frame: number[][], type: PenkoIconType): number[][] => {
  const m = frame.map(row => row.slice());
  switch (type) {
    case 'custom':
      for (let x = 5; x <= 10; x++) m[1][x] = 9; // Purple hat
      for (let x = 4; x <= 11; x++) m[2][x] = 9;
      m[2][7] = 6; m[2][8] = 6; // Gold star
      m[8][12] = 11; m[7][13] = 11; m[6][14] = 6; // Wand
      break;
    case 'lurch':
      m[7][7] = 1; m[7][8] = 1; // Black bow tie
      m[8][7] = 2; m[8][8] = 2; // White shirt collar
      m[9][6] = 1; m[9][9] = 1; // Black jacket shoulders
      m[10][6] = 1; m[10][9] = 1;
      break;
    case 'writer':
      // Suit and red tie
      m[8][7] = 5; m[8][8] = 5;
      m[9][8] = 5;
      m[10][8] = 5;
      m[8][6] = 1; m[9][6] = 1; m[10][6] = 1;
      m[8][9] = 1; m[9][9] = 1; m[10][9] = 1;
      // Giant diagonal pencil
      m[6][14] = 10; m[7][13] = 10; // Pink eraser
      m[8][12] = 6; m[9][11] = 6; m[10][10] = 6; // Yellow body
      m[11][9] = 11; m[12][8] = 1; // Wood + black lead tip
      break;
  }
  return m;
};

const frameCache = new Map<string, number[][][]>();
export const getPenkoFrames = (type: PenkoIconType, pose: PenkoPose): number[][][] => {
  const key = `${type}:${pose}`;
  let frames = frameCache.get(key);
  if (!frames) {
    const base = PENKO_ANIMATIONS[pose] || PENKO_ANIMATIONS.idle;
    frames = base.map(f => applyCostume(f, type));
    frameCache.set(key, frames);
  }
  return frames;
};

const drawFrame = (canvas: HTMLCanvasElement, matrix: number[][], size: number) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = canvas.width / size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const px = size / 16;
  for (let y = 0; y < matrix.length; y++) {
    const row = matrix[y];
    for (let x = 0; x < row.length; x++) {
      const color = COLORS[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const PenkoIcon: React.FC<PenkoIconProps> = React.memo(({ type, size = 64, className = '', pose = 'idle' }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dpr = typeof window !== 'undefined' ? Math.max(1, Math.ceil(window.devicePixelRatio || 1)) : 1;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frames = getPenkoFrames(type, pose);
    let index = 0;
    drawFrame(canvas, frames[0], size);
    if (frames.length <= 1) return;

    const delay = pose === 'talk' ? 300 : 500;
    let timer = 0;
    const tick = () => {
      index = (index + 1) % frames.length;
      drawFrame(canvas, frames[index], size);
    };
    const start = () => {
      if (timer || document.visibilityState === 'hidden' || prefersReducedMotion()) return;
      timer = window.setInterval(tick, delay);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [type, pose, size, dpr]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(size * dpr)}
      height={Math.round(size * dpr)}
      className={`${className} will-change-transform`}
      style={{ width: size, height: size, display: 'block', imageRendering: 'pixelated' }}
      aria-hidden="true"
    />
  );
});

PenkoIcon.displayName = 'PenkoIcon';

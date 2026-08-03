/**
 * Penko Animation Library
 * All animations for the Penko character
 *
 * Color Palette:
 * 0 = Transparent
 * 1 = Black (outline)
 * 2 = White (belly/eyes)
 * 3 = Blue-gray (body)
 * 4 = Orange (beak/feet)
 */

import { PENKO_IDLE } from './idle';
import { PENKO_WALK } from './walk';
import { PENKO_JUMP } from './jump';
import { PENKO_HURT } from './hurt';
import { PENKO_TALK } from './talk';
import { PENKO_WALK_RIGHT } from './walk_right';
import { PENKO_JUMP_RIGHT } from './jump_right';
import { PENKO_TOPDOWN } from './topdown';

export type PenkoAnimation = number[][][]; // 3D array: frames -> rows -> pixels

export const PENKO_ANIMATIONS = {
  idle: PENKO_IDLE,
  walk: PENKO_WALK,
  jump: PENKO_JUMP,
  hurt: PENKO_HURT,
  talk: PENKO_TALK,
  walk_right: PENKO_WALK_RIGHT,
  jump_right: PENKO_JUMP_RIGHT,
  ...PENKO_TOPDOWN
};

export type AnimationName = keyof typeof PENKO_ANIMATIONS;

// Color palette for rendering
export const PENKO_PALETTE = [
  'transparent',
  '#000000', // Black
  '#ffffff', // White
  '#5a7a8a', // Blue-gray
  '#ff8c00', // Orange
];

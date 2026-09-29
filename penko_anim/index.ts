/**
 * Penko Animation Library
 * All animations for the Penko character (16x16 pixel frames).
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

export type PenkoAnimation = number[][][]; // 3D array: frames -> rows -> pixels

export const PENKO_ANIMATIONS: Record<'idle' | 'walk' | 'jump' | 'hurt' | 'talk', PenkoAnimation> = {
  idle: PENKO_IDLE,
  walk: PENKO_WALK,
  jump: PENKO_JUMP,
  hurt: PENKO_HURT,
  talk: PENKO_TALK,
};

export type AnimationName = keyof typeof PENKO_ANIMATIONS;

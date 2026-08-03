
import { PENKO_IDLE } from './idle';
import { PENKO_WALK } from './walk';
import { PENKO_WALK_RIGHT } from './walk_right';

// To keep Penko looking consistent and prevent him from looking "squished", 
// we will just reuse his perfectly proportioned 16x16 side-profile sprites 
// for the top-down visualizer. We can map the directions to these existing frames.

// Flip a matrix horizontally for Left animations
const flipMatrix = (matrix) => {
  return matrix.map(row => [...row].reverse());
};

export const PENKO_TOPDOWN = {
  // Down/Up just use the standard facing-forward idle and walk
  idle_down: PENKO_IDLE,
  walk_down: PENKO_WALK,
  idle_up: PENKO_IDLE,
  walk_up: PENKO_WALK,
  
  // Right uses the walk_right animations
  idle_right: [PENKO_WALK_RIGHT[1]], // The middle standing frame of walk_right
  walk_right: PENKO_WALK_RIGHT,
  
  // Left is just Right flipped horizontally
  idle_left: [flipMatrix(PENKO_WALK_RIGHT[1])],
  walk_left: PENKO_WALK_RIGHT.map(flipMatrix)
};

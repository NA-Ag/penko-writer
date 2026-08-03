/**
 * Custom Penko Icons - Full Body Character Variants (Pixel Matrix)
 * Replaces standard emojis with thematic Penko character art based on the 16x16 animation frames.
 */

import React from 'react';
import { PENKO_ANIMATIONS } from '../penko_anim';

export type PenkoIconType = 
  | 'japanese' | 'custom'
  // N5
  | 'greetings' | 'cafe' | 'station' | 'clothes' | 'classmate' | 'weekend' | 'conbini' | 'sick' | 'visiting' | 'weather'
  // N4
  | 'clinic' | 'hotel' | 'moving' | 'postoffice' | 'late' | 'permission' | 'lostfound' | 'traveladvice' | 'parttime' | 'declining'
  // N3
  | 'neighbor' | 'grouptrip' | 'defective' | 'smalltalk' | 'movie' | 'hugefavor' | 'reportingissue' | 'console' | 'purchase' | 'health'
  // N2
  | 'business' | 'debate' | 'angrycustomer' | 'salesdata'
  // N1
  | 'philosophy' | 'news' | 'thesis' | 'diplomatic';

interface PenkoIconProps {
  type: string;
  size?: number;
  className?: string;
  pose?: 'idle' | 'talk' | 'hurt' | 'jump' | 'walk' | 'walk_right' | 'jump_right';
}

// Color palette: 0=transparent, 1=black, 2=white, 3=blue-gray, 4=orange, 
// 5=red, 6=yellow/gold, 7=blue, 8=green, 9=purple, 10=pink, 11=brown, 12=cyan, 13=gray
const COLORS = {
  0: 'transparent',
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

export const PenkoIcon: React.FC<PenkoIconProps> = React.memo(({ type, size = 64, className = '', pose = 'idle' }) => {
  const pixelSize = size / 16;
  const [frameIndex, setFrameIndex] = React.useState(0);

  const activePose = pose in PENKO_ANIMATIONS ? pose : 'idle';
  const frames = PENKO_ANIMATIONS[activePose];

  // Cycle animation frames
  React.useEffect(() => {
    setFrameIndex(0);
    if (!frames || frames.length <= 1) return;

    const fps = activePose === 'talk' ? 300 : 500; // Slower, smoother animations
    const interval = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % frames.length);
    }, fps);

    return () => clearInterval(interval);
  }, [frames, activePose]);

  // Use useMemo to avoid re-parsing on every small render
  const matrix = React.useMemo(() => {
    const currentFrame = frames[frameIndex] || frames[0];
    let m = JSON.parse(JSON.stringify(currentFrame));

    // Shared Helper: Suit and Red Tie for Office Suite
    const drawSuitAndTie = () => {
      // Red tie down the center chest (shifted down to y=8 to clear beak at y=7)
      m[8][7] = 5; m[8][8] = 5;
      m[9][8] = 5;
      m[10][8] = 5;
      // Black suit jacket collars over the white belly (shifted down)
      m[8][6] = 1; m[9][6] = 1; m[10][6] = 1;
      m[8][9] = 1; m[9][9] = 1; m[10][9] = 1;
    };

    // Apply "costume" modifications to the matrix
    switch (type) {
      case 'japanese':
        for(let x=3; x<=12; x++) m[2][x] = 2; // White band
        m[2][7] = 5; m[2][8] = 5; // Red sun in center
        m[3][2] = 2; m[4][1] = 2; // Tails
        break;

      case 'custom':
        for(let x=5; x<=10; x++) m[1][x] = 9; // Purple hat
        for(let x=4; x<=11; x++) m[2][x] = 9;
        m[2][7] = 6; m[2][8] = 6; // Gold star
        m[8][12] = 11; m[7][13] = 11; m[6][14] = 6; // Wand
        break;

      case 'lurch':
        m[7][7] = 1; m[7][8] = 1; // Black bow tie
        m[8][7] = 2; m[8][8] = 2; // White shirt collar
        m[9][6] = 1; m[9][9] = 1; // Black jacket shoulders
        m[10][6] = 1; m[10][9] = 1;
        break;

      case 'greetings':
        m[8][12] = 3; m[8][13] = 3; m[8][14] = 3;
        m[7][14] = 3;
        m[4][5] = 1; m[4][10] = 1; // Smile eyes
        break;
      case 'cafe':
        for(let x=5; x<=10; x++) { m[8][x] = 8; m[9][x] = 8; m[10][x] = 8; m[11][x] = 8; }
        m[8][12] = 2; m[9][12] = 2; m[9][13] = 1; // Cup + Handle
        m[7][12] = 11; // Steam/Coffee
        break;
      case 'station':
        for(let x=4; x<=11; x++) m[1][x] = 7;
        for(let x=3; x<=12; x++) m[2][x] = 7;
        for(let x=2; x<=13; x++) m[3][x] = 1; // Brim
        m[1][7] = 6; m[1][8] = 6; // Badge
        break;
      case 'clothes':
        for(let y=8; y<=12; y++) { for(let x=1; x<=4; x++) m[y][x] = 10; }
        m[7][2] = 1; m[7][3] = 1; // Handles
        m[10][2] = 2; m[10][3] = 2; // White Logo
        break;
      case 'classmate':
        m[8][5] = 5; m[9][5] = 5; m[10][5] = 5;
        m[8][10] = 5; m[9][10] = 5; m[10][10] = 5;
        break;
      case 'weekend':
        m[8][2] = 10; m[9][2] = 10; m[10][2] = 10;
        m[7][2] = 8; // Lime slice
        for(let x=3; x<=12; x++) m[4][x] = 1; // Sunglasses
        break;
      case 'conbini':
        for(let x=4; x<=11; x++) {
            m[8][x] = 7; // Blue
            m[9][x] = 8; // Green
            m[10][x] = 2; // White
        }
        break;
      case 'sick':
        m[6][11] = 2; m[6][12] = 2; m[6][13] = 2; m[6][14] = 5;
        for(let x=5; x<=9; x++) m[1][x] = 12; // Ice pack
        m[0][7] = 12;
        m[4][5] = 3; m[4][10] = 3; // Sad eyes
        break;
      case 'visiting':
        for(let y=8; y<=11; y++) { m[y][2] = 10; m[y][3] = 10; m[y][4] = 10; }
        m[9][3] = 2; m[8][3] = 5; // Ribbon
        break;
      case 'weather':
        m[3][3] = 7; m[2][4] = 7; m[2][5] = 7; m[3][6] = 7;
        for(let x=3; x<=6; x++) m[4][x] = 7; // Canopy
        for(let y=5; y<=10; y++) m[y][4] = 11; // Handle
        m[11][3] = 11; m[11][4] = 11;
        break;

      case 'clinic':
        for(let x=5; x<=10; x++) { m[1][x] = 2; m[2][x] = 2; }
        m[1][7] = 5; m[2][7] = 5; m[1][8] = 5; m[2][8] = 5; // Cross
        m[7][5] = 1; m[8][5] = 1; m[9][6] = 1; m[9][7] = 1; // Stetho
        break;
      case 'hotel':
        for(let x=5; x<=10; x++) { m[1][x] = 5; m[2][x] = 5; }
        m[2][7] = 6; m[2][8] = 6; // Gold trim
        break;
      case 'moving':
        for(let y=8; y<=12; y++) { for(let x=4; x<=11; x++) m[y][x] = 11; }
        m[10][7] = 1; m[10][8] = 1; // Tape
        break;
      case 'postoffice':
        for(let y=9; y<=12; y++) { m[y][2] = 5; m[y][3] = 5; m[y][4] = 5; }
        m[10][3] = 2; // White logo
        for(let x=4; x<=11; x++) m[2][x] = 5; // Cap
        m[3][12] = 1; // Visor
        break;
      case 'late':
        m[2][3] = 12; m[3][3] = 12; m[3][13] = 12; m[4][13] = 12;
        m[4][5] = 1; m[3][5] = 1; m[4][10] = 1; m[3][10] = 1; // Wide eyes
        m[13][12] = 4; m[12][13] = 4; // Running foot
        break;
      case 'permission':
        m[4][5] = 3; m[4][10] = 3; // Erase old eyes
        m[6][5] = 1; m[6][10] = 1; // New eyes lower
        m[6][7] = 3; m[6][8] = 3; // Erase old beak
        m[8][7] = 4; m[8][8] = 4; // New beak lower
        m[2][3] = 12; m[3][3] = 12; // Sweat
        break;
      case 'lostfound':
        m[7][12] = 1; m[7][13] = 1; m[7][14] = 1;
        m[8][12] = 1; m[8][13] = 12; m[8][14] = 1;
        m[9][12] = 1; m[9][13] = 1; m[9][14] = 1;
        m[10][11] = 13; m[11][10] = 13; // Handle
        break;
      case 'traveladvice':
        for(let x=4; x<=11; x++) m[2][x] = 6;
        for(let x=3; x<=12; x++) m[3][x] = 6;
        m[8][6] = 1; m[8][7] = 1; m[8][8] = 1; m[8][9] = 1;
        m[9][6] = 1; m[9][7] = 12; m[9][8] = 1; m[9][9] = 1; // Cyan lens
        break;
      case 'parttime':
        for(let x=5; x<=10; x++) { m[8][x] = 11; m[9][x] = 11; m[10][x] = 11; } // Apron
        m[7][2] = 2; m[8][2] = 2; m[9][2] = 2; m[10][2] = 2; // Clipboard
        m[6][2] = 13; // Clip
        break;
      case 'declining':
        m[7][12] = 3; m[6][13] = 3; m[5][13] = 3; m[4][13] = 3;
        m[4][5] = 1; m[4][10] = 1;
        m[3][5] = 2; m[3][10] = 2; // Lines for eyes
        break;

      case 'neighbor':
        m[5][2] = 3; m[6][2] = 3; m[7][2] = 3;
        m[5][13] = 3; m[6][13] = 3; m[7][13] = 3;
        m[3][4] = 5; m[4][5] = 5; m[3][11] = 5; m[4][10] = 5; // Angry brows
        break;
      case 'grouptrip':
        for(let y=8; y<=11; y++) { m[y][3] = 2; m[y][4] = 2; m[y][5] = 2; }
        m[9][4] = 5; // X marks the spot
        break;
      case 'defective':
        m[8][2] = 13; m[8][4] = 13; m[9][3] = 13; m[10][2] = 13; m[10][4] = 13;
        m[4][5] = 3; m[4][10] = 3; // Sad eyes
        break;
      case 'smalltalk':
        m[9][3] = 2; m[10][3] = 2; m[10][4] = 2;
        m[2][13] = 2; m[2][14] = 2; m[3][14] = 2;
        break;
      case 'movie':
        m[4][4] = 5; m[4][5] = 5; m[4][6] = 5; // Left red
        m[4][9] = 12; m[4][10] = 12; m[4][11] = 12; // Right cyan
        m[4][7] = 1; m[4][8] = 1; // Bridge
        break;
      case 'hugefavor':
        m[2][2] = 12; m[3][2] = 12;
        m[2][13] = 12; m[3][13] = 12;
        m[4][3] = 12; m[5][3] = 12;
        m[4][12] = 12; m[5][12] = 12;
        break;
      case 'reportingissue':
        for(let x=3; x<=12; x++) m[2][x] = 6;
        for(let x=4; x<=11; x++) m[1][x] = 6;
        m[8][2] = 13; m[9][2] = 13; m[10][2] = 13; m[11][2] = 13;
        m[7][1] = 13; m[7][3] = 13;
        break;
      case 'console':
        for(let y=9; y<=11; y++) { m[y][2] = 7; m[y][3] = 7; m[y][4] = 7; }
        m[8][3] = 2; // Tissue sticking out
        m[4][5] = 3; m[4][10] = 3; // Empathetic eyes
        break;
      case 'purchase':
        for(let y=8; y<=10; y++) { m[y][2] = 8; m[y][3] = 8; m[y][4] = 8; }
        m[9][3] = 6; // Gold coin in middle
        break;
      case 'health':
        for(let x=3; x<=12; x++) m[2][x] = 5;
        m[9][1] = 1; m[10][1] = 1; m[11][1] = 1;
        m[10][2] = 13; m[10][3] = 13; // Bar
        m[9][4] = 1; m[10][4] = 1; m[11][4] = 1;
        break;

      case 'business':
        m[7][7] = 5; m[7][8] = 5; m[8][7] = 5; m[8][8] = 5; m[9][8] = 5; m[10][8] = 5;
        for(let y=9; y<=12; y++) { m[y][2] = 11; m[y][3] = 11; m[y][4] = 11; }
        m[8][3] = 1; // Handle
        break;
      case 'debate':
        m[8][12] = 3; m[7][13] = 3; m[6][14] = 3;
        m[4][4] = 1; m[4][6] = 1; m[4][9] = 1; m[4][11] = 1; m[4][7] = 1; m[4][8] = 1;
        break;
      case 'angrycustomer':
        m[3][4] = 5; m[4][5] = 5; m[3][11] = 5; m[4][10] = 5;
        m[1][2] = 4; m[2][1] = 4; m[1][13] = 4; m[2][14] = 4;
        break;
      case 'salesdata':
        m[8][12] = 13; m[7][13] = 13; m[6][14] = 13; // Pointer
        m[1][1] = 2; m[1][2] = 2; m[2][1] = 2; m[2][2] = 2;
        m[2][2] = 5; // Red line
        break;

      case 'philosophy':
        m[4][9] = 6; m[4][11] = 6; m[3][10] = 6; m[5][10] = 6;
        for(let y=9; y<=11; y++) { m[y][2] = 11; m[y][3] = 11; m[y][4] = 2; }
        break;
      case 'news':
        m[9][3] = 1; m[10][3] = 1; m[11][3] = 1; // Handle
        m[8][3] = 13; m[7][3] = 13; // Mic head
        for(let x=4; x<=11; x++) m[2][x] = 1;
        for(let x=3; x<=12; x++) m[3][x] = 1;
        m[2][5] = 2; // Press card
        break;
      case 'thesis':
        for(let x=2; x<=13; x++) m[1][x] = 1; // Diamond top
        m[0][7] = 1; m[0][8] = 1;
        for(let y=2; y<=4; y++) m[y][13] = 6; // Tassel
        for(let y=9; y<=12; y++) m[y][3] = 2; // Scroll
        m[9][2] = 6; m[12][2] = 6; // Ribbon
        break;
      case 'diplomatic':
        m[7][7] = 5; m[7][8] = 5; // Tie
        m[4][9] = 6; m[4][11] = 6; m[3][10] = 6; m[5][10] = 6; m[6][11] = 6; // Monocle
        for(let y=0; y<=2; y++) { for(let x=5; x<=10; x++) m[y][x] = 1; } // Top hat
        for(let x=3; x<=12; x++) m[3][x] = 1; // Brim
        break;

      // Unique App Brand Costumes
      case 'writer':
        drawSuitAndTie();
        // Exaggerated Giant Diagonal Pencil in wing/side
        m[6][14] = 10; m[7][13] = 10; // Pink eraser
        m[8][12] = 6; m[9][11] = 6; m[10][10] = 6; // Yellow body
        m[11][9] = 11; m[12][8] = 1; // Wood + black lead tip
        break;
      case 'adventure':
        // Red knight plume on top of helmet
        m[0][7] = 5; m[0][8] = 5; m[1][7] = 5; m[1][8] = 5;
        // Silver helmet on head
        for(let x=4; x<=11; x++) m[2][x] = 13;
        for(let x=3; x<=12; x++) m[3][x] = 13;
        m[3][7] = 6; m[3][8] = 6; // Golden gem on helmet visor
        // Red cape flowing down the left side background
        for (let y=6; y<=12; y++) {
          if (m[y][1] === 0) m[y][1] = 5;
          if (m[y][2] === 0) m[y][2] = 5;
        }
        // Round wooden shield with gold rim on the left
        for(let y=9; y<=11; y++) {
          for(let x=2; x<=4; x++) {
            m[y][x] = 6; // Golden rim
          }
        }
        m[10][3] = 11; // Brown shield center
        // Giant silver sword in wing (drawn in foreground/layered)
        m[10][11] = 11; m[9][11] = 11; // Brown wood hilt
        m[8][10] = 6; m[8][11] = 6; m[8][12] = 6; // Golden crossguard
        m[7][11] = 13; m[6][11] = 13; m[5][11] = 13; m[4][11] = 13; // Silver blade
        break;
      case 'tune':
        // Over-ear headphones on Penko (enlarged retro studio headphones)
        for(let x=3; x<=12; x++) {
          m[1][x] = 1; m[2][x] = 1; // Thicker double-row headphone band
        }
        for(let y=3; y<=6; y++) {
          m[y][2]=9; m[y][3]=9; // Larger double-width left purple earmuff
          m[y][12]=9; m[y][13]=9; // Larger double-width right purple earmuff
        }
        // Giant black vinyl record disc on left side
        m[8][2]=1; m[9][1]=1; m[10][1]=1; m[11][2]=1; m[12][3]=1; m[12][4]=1; m[11][5]=1; m[10][6]=1; m[9][6]=1; m[8][5]=1; // Disc outer ring
        m[10][3]=6; m[10][4]=6; // Gold center label
        break;
      case 'typing':
        // Laptop standing on Penko's side
        // Laptop Lid / Screen standing up (x=1 to x=5, y=6 to y=10)
        for(let y=6; y<=10; y++) {
          m[y][1] = 13; m[y][5] = 13; // Lid edges
        }
        for(let x=1; x<=5; x++) m[6][x] = 13; // Lid top
        for(let y=7; y<=9; y++) {
          for(let x=2; x<=4; x++) m[y][x] = 12; // Glowing cyan screen
        }
        // Laptop base deck
        for(let x=1; x<=6; x++) m[11][x] = 13; // Base top edge
        for(let x=2; x<=5; x++) m[12][x] = 1; // Black keyboard keycaps row
        break;
      case 'reader':
        // Giant open book (with a bright RED cover)
        for(let x=2; x<=13; x++) m[12][x] = 5; // Red bottom cover
        m[9][2] = 5; m[10][2] = 5; m[11][2] = 5; // Red left cover edge
        m[9][13] = 5; m[10][13] = 5; m[11][13] = 5; // Red right cover edge
        for(let y=9; y<=11; y++) {
          for(let x=3; x<=12; x++) {
            if(x !== 7 && x !== 8) m[y][x] = 2; // White pages
          }
        }
        m[10][7] = 6; m[11][7] = 6; // Golden bookmark ribbon standing out against red
        break;
      case 'soroban':
        // Giant wooden abacus frame
        for(let y=8; y<=12; y++) {
          m[y][1] = 11; // Left wood column
          m[y][7] = 11; // Right wood column
        }
        for(let x=1; x<=7; x++) {
          m[8][x] = 11; // Top beam
          m[12][x] = 11; // Bottom beam
          m[10][x] = 11; // Divider beam
        }
        // Beads
        m[9][3] = 6; m[11][3] = 6; // Yellow beads
        m[9][5] = 6; m[11][5] = 6;
        break;
      case 'calc':
        drawSuitAndTie();
        // Exaggerated Giant Calculator on side (x=1 to x=4, y=8 to y=12)
        for(let y=8; y<=12; y++) { for(let x=1; x<=4; x++) m[y][x] = 13; } // Gray frame
        m[9][2] = 12; m[9][3] = 12; // Glowing cyan screen
        m[11][2] = 1; m[11][3] = 1; m[12][2] = 1; m[12][3] = 1; // Buttons
        break;
      case 'note':
        drawSuitAndTie();
        // Giant yellow spiral notepad on side (x=1 to x=4, y=8 to y=12)
        for(let y=8; y<=12; y++) { for(let x=1; x<=4; x++) m[y][x] = 6; } // Yellow memo sheet
        m[7][1]=1; m[7][2]=1; m[7][3]=1; m[7][4]=1; // Spiral binder loops
        break;
      case 'slide':
        drawSuitAndTie();
        // Giant presentation projector screen in the background (drawn behind Penko using background checks)
        for(let x=2; x<=13; x++) {
          if (m[4][x] === 0) m[4][x] = 13; // Top horizontal bar
        }
        for(let y=5; y<=8; y++) {
          for(let x=3; x<=12; x++) {
            if (m[y][x] === 0) m[y][x] = 2; // White screen
          }
        }
        // Tripod legs showing at the bottom sides
        if (m[9][2] === 0) m[9][2] = 13;
        if (m[10][1] === 0) m[10][1] = 13;
        if (m[9][13] === 0) m[9][13] = 13;
        if (m[10][14] === 0) m[10][14] = 13;
        break;
      case 'access':
        drawSuitAndTie();
        // Giant Golden Key in wing (x=11 to x=14, y=7 to y=12)
        m[7][11] = 6; m[7][12] = 6; m[8][11] = 6; m[8][12] = 6; // Key head ring
        m[9][11] = 6; m[10][11] = 6; m[11][11] = 6; m[12][11] = 6; // Key shaft
        m[10][12] = 6; m[11][12] = 6; // Key teeth
        break;
      case 'insight':
        drawSuitAndTie();
        // Giant Magnifying Glass (gold frame and handle with a cyan lens)
        m[4][9]=6; m[4][10]=6; m[4][11]=6; 
        m[5][9]=6; m[5][10]=12; m[5][11]=6; // Cyan lens inside gold ring
        m[6][9]=6; m[6][10]=6; m[6][11]=6; 
        m[7][12]=11; m[8][13]=11; // Handle sticking out
        break;
      case 'publish':
        drawSuitAndTie();
        // Giant Folded Newspaper
        for(let y=8; y<=12; y++) { for(let x=1; x<=4; x++) m[y][x] = 2; } // White sheet folded
        m[9][2]=13; m[9][3]=13; m[10][2]=13; m[10][3]=13; // Printed text article lines
        break;
      case 'pdf':
        drawSuitAndTie();
        // Giant Red PDF Cover Document
        for(let y=8; y<=12; y++) { for(let x=1; x<=4; x++) m[y][x] = 5; } // Red cover sheet
        m[9][2]=2; m[10][2]=2; // White page lines
        break;
      case 'vector':
        // Artist red beret cap
        for (let x=4; x<=11; x++) m[2][x] = 5;
        m[1][7] = 5; // Beret top node stem
        // Giant Vector Pen Tool drawing a neon cyan curve node
        m[11][2]=12; m[9][5]=12; m[7][9]=12; m[5][13]=13; // Neon curve line points
        m[7][8]=1; m[8][9]=1; m[9][10]=6; // Golden pen nib tip
        break;
      case 'image':
        // Artist blue beret cap
        for (let x=4; x<=11; x++) m[2][x] = 7;
        m[1][7] = 7;
        // Giant camera on neck strap with big cyan lens
        for(let y=8; y<=11; y++) {
          for(let x=1; x<=5; x++) m[y][x] = 13; // Camera body
        }
        for(let y=9; y<=10; y++) {
          for(let x=2; x<=4; x++) m[y][x] = 12; // Glowing cyan lens
        }
        m[7][2] = 1; m[7][3] = 1; // Neck strap connector
        break;
      case 'cut':
        // Artist green beret cap
        for (let x=4; x<=11; x++) m[2][x] = 8;
        m[1][7] = 8;
        // Giant Scissors cutting paper sheet
        m[7][12]=13; m[7][13]=13; m[8][11]=13; m[9][12]=13; m[10][13]=13; // Silver scissors blades
        m[6][14]=6; m[11][14]=6; // Gold scissor handles
        // Small paper scraps falling down
        m[11][2]=5; m[12][3]=6;
        break;
      case 'erp':
        // Giant mechanical gear cogs overlay
        m[9][3]=6; m[8][2]=6; m[8][4]=6; m[10][2]=6; m[10][4]=6; // Big gear center & teeth
        m[5][12]=13; m[4][11]=13; m[4][13]=13; m[6][11]=13; m[6][13]=13; // Smaller gear in background
        break;
      case 'hcm':
        // Corporate theme: three smaller helper penguins standing on sides
        m[9][1]=13; m[10][1]=2; // Teammate 1
        m[9][14]=13; m[10][14]=2; // Teammate 2
        m[8][2]=13; m[9][2]=2; // Teammate 3
        break;
      case 'db':
        // Tall stacked database cylinders (blue cylinders)
        for(let x=3; x<=6; x++) {
          m[6][x] = 7; m[8][x] = 7; m[10][x] = 7; // Tops & dividers
          m[7][x] = 12; m[9][x] = 12; m[11][x] = 12; // Glowing data panels
        }
        break;
      case 'campus':
        // Giant graduation mortarboard cap + diploma scroll
        for(let x=3; x<=12; x++) m[1][x] = 1; // Black flat top board
        m[2][7]=1; m[2][8]=1; m[3][11]=6; // Yellow tassel
        // Diploma scroll held in wing
        m[10][12]=2; m[11][12]=2; m[10][13]=5; // White paper roll with red ribbon bow
        break;
      case 'private':
        // Incognito spy style: Fedora Hat + Specs + High Collar
        // Black Fedora hat (y=0 to y=3)
        for (let x=5; x<=10; x++) {
          m[0][x] = 1; m[1][x] = 1; m[2][x] = 1; // Crown
        }
        for (let x=3; x<=12; x++) m[3][x] = 1; // Hat brim
        for (let x=5; x<=10; x++) m[2][x] = 13; // Gray hatband ribbon
        // Spy round glasses / Specs
        m[5][3]=1; m[5][4]=1; m[5][5]=1; m[5][6]=1; m[5][7]=1; // Left frame
        m[6][3]=1; m[6][7]=1; m[7][4]=1; m[7][5]=1; m[7][6]=1;
        m[5][9]=1; m[5][10]=1; m[5][11]=1; m[5][12]=1; m[5][13]=1; // Right frame
        m[6][9]=1; m[6][13]=1; m[7][10]=1; m[7][11]=1; m[7][12]=1;
        m[6][8]=1; // Nose bridge link
        // Spy trenchcoat high collar lapels
        m[9][2]=1; m[10][2]=1; m[11][3]=1; // Left lapel
        m[9][13]=1; m[10][13]=1; m[11][12]=1; // Right lapel
        break;
      case 'glow':
        // Sleep mask + sparkling wellness aura bubbles
        for(let x=4; x<=11; x++) m[4][x] = 9; // Purple sleep mask over eyes
        m[1][3]=12; m[2][13]=12; m[11][1]=12; m[10][14]=12; // Cyan sparkling aura bubbles
        break;
    }
    return m;
  }, [type, frames, frameIndex]);

  return (
    <div
      className={`${className} will-change-transform`}
      style={{
        width: size,
        height: size,
        display: 'grid',
        gridTemplateColumns: `repeat(16, ${pixelSize}px)`,
        gridTemplateRows: `repeat(16, ${pixelSize}px)`,
        imageRendering: 'pixelated',
      }}
    >
      {matrix.map((row: number[], y: number) =>
        row.map((cell: number, x: number) => (
          <div
            key={`${x}-${y}`}
            style={{
              backgroundColor: COLORS[cell as keyof typeof COLORS],
              width: pixelSize,
              height: pixelSize,
            }}
          />
        ))
      )}
    </div>
  );
});

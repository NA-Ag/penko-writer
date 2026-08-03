#!/usr/bin/env node

/**
 * Generate PWA icons from penguin-logo.svg
 * This script creates PNG icons at various sizes for PWA support
 *
 * For now, we'll copy the SVG as placeholder icons.
 * For production, you can use tools like:
 * - sharp (npm install sharp) for server-side conversion
 * - inkscape CLI for SVG to PNG conversion
 * - Online tools like realfavicongenerator.net
 */

const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'penguin-logo.svg');
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const maskableSizes = [192, 512];

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Read the SVG content
const svgContent = fs.readFileSync(svgPath, 'utf8');

console.log('🎨 Generating PWA icons...\n');

// For each size, create a resized SVG version
sizes.forEach(size => {
  const resizedSvg = svgContent.replace(
    /width="32" height="32"/,
    `width="${size}" height="${size}"`
  );

  const filename = `icon-${size}x${size}.svg`;
  const filePath = path.join(iconsDir, filename);

  fs.writeFileSync(filePath, resizedSvg);
  console.log(`✓ Created ${filename}`);
});

// Create maskable versions with padding (safe zone for rounded icons)
maskableSizes.forEach(size => {
  // For maskable icons, we need to add padding
  // Android/iOS may crop circular icons, so we add a safe zone
  const padding = size * 0.1;
  const iconSize = size - (padding * 2);

  const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <!-- Background for maskable icon -->
  <rect width="${size}" height="${size}" fill="#3b82f6"/>
  <!-- Centered penguin with safe zone -->
  <g transform="translate(${padding}, ${padding})">
    ${svgContent.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/width="32" height="32"/, `width="${iconSize}" height="${iconSize}"`)}
  </g>
</svg>`;

  const filename = `icon-maskable-${size}x${size}.svg`;
  const filePath = path.join(iconsDir, filename);

  fs.writeFileSync(filePath, maskableSvg);
  console.log(`✓ Created ${filename} (maskable)`);
});

console.log('\n✨ Icon generation complete!');
console.log('\n📝 Note: SVG icons are used as placeholders.');
console.log('For production, convert these to PNG using:');
console.log('  - sharp: npm install sharp && node scripts/convert-to-png.js');
console.log('  - inkscape: inkscape -w SIZE -h SIZE input.svg -o output.png');
console.log('  - Online: https://realfavicongenerator.net\n');

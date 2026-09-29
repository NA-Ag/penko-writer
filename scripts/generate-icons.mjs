#!/usr/bin/env node
/**
 * Generate the PWA / favicon PNG icons from public/penguin-logo.svg.
 *
 *   npm run icons
 *
 * Renders with Playwright's Chromium (already a dev dependency) so no native
 * image library is needed. Output goes to public/icons/ and is committed.
 *
 * - icon-<n>x<n>.png           "any" purpose: the logo as-is (rounded tile).
 * - icon-maskable-<n>x<n>.png  "maskable": full-bleed blue square with the
 *                              mascot scaled into the 80% safe zone.
 * - apple-touch-icon.png       180x180 full-bleed (iOS applies its own mask).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'public', 'penguin-logo.svg'), 'utf8');
const outDir = path.join(root, 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// Everything inside <svg>…</svg> except the rounded background tile.
const inner = svg
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<rect width="20" height="20"[^>]*\/>/, '');
const BG = '#2563eb';

const anySvg = svg;
const fullBleed = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" shape-rendering="crispEdges">
  <rect width="20" height="20" fill="${BG}"/>
  <g transform="translate(10 10) scale(${scale}) translate(-10 -10)">${inner}</g>
</svg>`;

const jobs = [
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((s) => ({ name: `icon-${s}x${s}.png`, size: s, svg: anySvg })),
  ...[192, 512].map((s) => ({ name: `icon-maskable-${s}x${s}.png`, size: s, svg: fullBleed(0.78) })),
  { name: 'apple-touch-icon.png', size: 180, svg: fullBleed(0.9) },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const job of jobs) {
  const sized = job.svg.replace(/<svg[^>]*>/, (tag) =>
    tag.replace(/\s(width|height)="[^"]*"/g, '').replace(/>$/, ` width="${job.size}" height="${job.size}">`));
  await page.setViewportSize({ width: job.size, height: job.size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`,
  );
  await page.locator('svg').screenshot({ path: path.join(outDir, job.name), omitBackground: true });
  console.log(`  ${job.name}`);
}
await browser.close();
console.log(`Icons written to ${path.relative(root, outDir)}/`);

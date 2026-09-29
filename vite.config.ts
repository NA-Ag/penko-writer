import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Public base path.
 * - Root / custom domain: leave unset ('/').
 * - GitHub Pages project site (github.com/NA-Ag/penko-writer): BASE_PATH=/penko-writer/
 * Either `BASE_PATH` or `VITE_BASE` is honoured (env var or .env file).
 */
function resolveBase(mode: string): string {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  let base = (env.BASE_PATH || env.VITE_BASE || '/').trim();
  if (!base.startsWith('/') && !base.startsWith('.')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

/**
 * jsPDF lazily imports html2canvas (for `pdf.html()`) and canvg (for SVG) —
 * features the PDF export doesn't use. Without this they become ~360 kB of
 * chunks the service worker precaches for nothing.
 */
const UNUSED_JSPDF_DEPS = new Set(['html2canvas', 'canvg']);
const stubUnusedJspdfDeps = (): Plugin => ({
  name: 'penko-stub-unused-jspdf-deps',
  apply: 'build',
  enforce: 'pre',
  resolveId(id, importer) {
    if (UNUSED_JSPDF_DEPS.has(id) && importer && /[\\/]jspdf[\\/]/.test(importer)) return `\0penko-unused:${id}`;
    return null;
  },
  load(id) {
    if (id.startsWith('\0penko-unused:')) return `export default function unavailable() { throw new Error('${id.slice('\0penko-unused:'.length)} is not bundled'); }`;
    return null;
  },
});

export default defineConfig(({ mode }) => {
  const base = resolveBase(mode);

  return {
    base,
    server: {
      // 3000 is often taken by other projects; fall back to the next free port.
      port: 3100,
      strictPort: false,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      stubUnusedJspdfDeps(),
      VitePWA({
        // New versions wait until the user accepts the in-app update banner.
        registerType: 'prompt',
        // Registration is done manually in utils/pwa.ts (virtual:pwa-register).
        injectRegister: false,
        // Icons are already picked up by globPatterns below.
        includeManifestIcons: false,
        manifest: {
          id: base,
          name: 'Penko Writer',
          short_name: 'Penko',
          description:
            'Privacy-focused, offline-first document editor. A free, open-source alternative to Microsoft Word and Google Docs.',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#3b82f6',
          orientation: 'any',
          categories: ['productivity', 'business', 'education'],
          lang: 'en-US',
          dir: 'ltr',
          prefer_related_applications: false,
          related_applications: [],
          icons: [
            ...[72, 96, 128, 144, 152, 192, 384, 512].map((s) => ({
              src: `icons/icon-${s}x${s}.png`,
              sizes: `${s}x${s}`,
              type: 'image/png',
              purpose: 'any',
            })),
            { src: 'icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: 'icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          // Installed app (Chromium): open .penko files from the OS (handled via launchQueue in state/FilesContext.tsx)
          file_handlers: [{ action: base, accept: { 'application/vnd.penko.document': ['.penko'] } }],
          launch_handler: { client_mode: 'focus-existing' },
          shortcuts: [
            {
              name: 'New Document',
              short_name: 'New',
              description: 'Create a new blank document',
              url: `${base}?action=new`,
              icons: [{ src: 'icons/icon-96x96.png', sizes: '96x96', type: 'image/png' }],
            },
          ],
        },
        workbox: {
          // App shell + hashed build output + self-hosted fonts (woff2 only:
          // every supported browser picks woff2 over the woff fallback).
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
          // The editor chunk is large; make sure it is still precached.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              // Anything same-origin that was not precached (e.g. .woff/.ttf fallbacks).
              urlPattern: ({ sameOrigin, request }) =>
                sameOrigin && ['font', 'image', 'style', 'script'].includes(request.destination),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'penko-runtime-assets',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          // Stable vendor chunks: they change rarely, so returning users (and
          // the service worker) re-download only the app code after an update.
          manualChunks(id) {
            // Vite's preload helper / Rollup's CJS helpers are shared by every chunk;
            // keep them out of lazily loaded vendor chunks (see vendor-runtime below).
            if (/vite\/preload-helper|commonjsHelpers/.test(id)) return 'vendor-runtime';
            if (!id.includes('/node_modules/')) return undefined;
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
            if (/\/node_modules\/(katex|prismjs)\//.test(id)) return 'vendor-editor';
            // Real-time collaboration (Y.js binding), used by the editor at startup.
            if (/\/node_modules\/(yjs|lib0|y-protocols|@tiptap\/y-tiptap|@tiptap\/extension-collaboration[^/]*)\//.test(id))
              return 'vendor-yjs';
            // Tiny helpers shared by jspdf and startup code; without this Rollup pulls
            // them into vendor-jspdf, which then has to load at startup.
            if (/\/node_modules\/@babel\/runtime\//.test(id)) return 'vendor-runtime';
            // Export libraries: only reached through the lazily imported utils/export.
            if (/\/node_modules\/docx\//.test(id)) return 'vendor-docx';
            // Shared by import, export and the backup ZIP (otherwise Rollup names it after a random module)
            if (/\/node_modules\/jszip\//.test(id)) return 'vendor-zip';
            if (/\/node_modules\/jspdf[^/]*\//.test(id)) return 'vendor-jspdf';
            if (
              /\/node_modules\/(@tiptap\/[^/]+|prosemirror-[^/]+|orderedmap|rope-sequence|w3c-keyname|linkifyjs|fast-equals)\//.test(
                id,
              )
            )
              return 'vendor-tiptap';
            return undefined;
          },
        },
      },
    },
  };
});

import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // For GitHub Pages: set base to your repo name
  // Example: base: '/penko-writer/'
  // For custom domain or root deployment: base: '/'
  base: '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-editor': ['katex', 'prismjs'],
          'vendor-export': ['jspdf', 'docx', 'html2canvas'],
        }
      }
    }
  }
});

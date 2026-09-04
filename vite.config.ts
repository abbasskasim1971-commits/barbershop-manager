import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  root: 'src/renderer',
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'src/renderer/domain'),
      '@application': path.resolve(__dirname, 'src/renderer/application'),
      '@infrastructure': path.resolve(__dirname, 'src/renderer/infrastructure'),
      '@presentation': path.resolve(__dirname, 'src/renderer/presentation'),
    },
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
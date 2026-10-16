import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Owned by the template: generated code can never change build configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});

import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';
import { versionPlugin } from './etc/vite-plugin-version';

export default defineConfig({
  plugins: [
    versionPlugin(),
    preact(),
    crx({ manifest })
  ],
  build: {
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

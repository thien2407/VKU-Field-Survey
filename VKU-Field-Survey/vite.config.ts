import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
import path from 'path';

function pwaPrecachePlugin() {
  return {
    name: 'pwa-precache-plugin',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const assetsDir = path.resolve(distDir, 'assets');
      if (!fs.existsSync(assetsDir)) return;

      const assetFiles = fs.readdirSync(assetsDir)
        .filter((f) => !f.endsWith('.map'))
        .map((f) => `./assets/${f}`);

      const coreAssets = [
        './',
        './index.html',
        './manifest.json',
        './favicon.svg',
        './apple-touch-icon.png',
        './icons/icon-192.png',
        './icons/icon-192.svg',
        './icons/icon-512.png',
        './icons/icon-512.svg',
        ...assetFiles,
      ];

      const swPath = path.resolve(distDir, 'sw.js');
      if (fs.existsSync(swPath)) {
        let swContent = fs.readFileSync(swPath, 'utf-8');
        const precacheListStr = JSON.stringify(coreAssets, null, 2);
        swContent = swContent.replace(
          /const PRECACHE_ASSETS = \[[\s\S]*?\];/,
          `const PRECACHE_ASSETS = ${precacheListStr};`
        );
        fs.writeFileSync(swPath, swContent, 'utf-8');
        console.log(`[PWA Plugin] Đã cập nhật dist/sw.js với ${coreAssets.length} assets precache.`);
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    basicSsl(),
    pwaPrecachePlugin(),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});

import { defineConfig } from 'vite';
import { resolve } from 'path';

// VITE_ENTRY 環境変数で対象エントリを切り替える（build.js から呼び出す）
const entry = process.env.VITE_ENTRY || 'desktop';
const entryMap = {
  desktop: 'src/js/desktop.js',
  mobile:  'src/js/mobile.js',
  config:  'src/js/config.js',
};

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: entry === 'desktop',
    lib: {
      entry: resolve(__dirname, entryMap[entry]),
      name: 'AttazooInputConditions_' + entry,
      fileName: () => `js/${entry}.js`,
      formats: ['iife'],
    },
    copyPublicDir: false,
  },
});

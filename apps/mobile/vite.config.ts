import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: { '@footlab/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) } }, plugins: [vue(), tailwindcss()], build: { chunkSizeWarningLimit: 1500 }, server: { port: 5173 } });

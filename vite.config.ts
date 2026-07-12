import { defineConfig } from 'vite';

const githubRepository = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' && githubRepository ? `/${githubRepository}/` : '/',
  server: {
    host: '127.0.0.1',
    port: 5188,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4188,
    strictPort: true,
  },
  build: {
    outDir: 'dist/client',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
});

import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

await rm(resolve(dist, 'server'), { recursive: true, force: true });
await mkdir(resolve(dist, 'server'), { recursive: true });
await mkdir(resolve(dist, '.openai'), { recursive: true });

await Promise.all([
  copyFile(resolve(root, 'sites/server-entry.js'), resolve(dist, 'server/index.js')),
  copyFile(resolve(root, '.openai/hosting.json'), resolve(dist, '.openai/hosting.json')),
]);

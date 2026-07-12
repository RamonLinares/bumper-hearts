import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const root = resolve(import.meta.dirname, '..');
const clientRoot = resolve(root, 'dist/client');
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function safeAssetPath(pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = resolve(clientRoot, relative);
  assert(filePath === clientRoot || filePath.startsWith(`${clientRoot}${sep}`), `Unsafe asset path: ${pathname}`);
  return filePath;
}

async function installStaticBundleRoute(page) {
  await page.route('http://bumper-hearts.test/**', async (route) => {
    try {
      const pathname = new URL(route.request().url()).pathname;
      const filePath = safeAssetPath(pathname);
      const body = await readFile(filePath);
      await route.fulfill({ status: 200, contentType: mimeTypes[extname(filePath)] ?? 'application/octet-stream', body });
    } catch (error) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: String(error) });
    }
  });
}

function assertCanvasIsDetailed(buffer) {
  const png = PNG.sync.read(buffer);
  const buckets = new Set();
  let min = 255;
  let max = 0;
  const stride = Math.max(1, Math.floor((png.width * png.height) / 6000));
  for (let pixel = 0; pixel < png.width * png.height; pixel += stride) {
    const offset = pixel * 4;
    const [r, g, b] = png.data.subarray(offset, offset + 3);
    min = Math.min(min, r, g, b);
    max = Math.max(max, r, g, b);
    buckets.add(`${r >> 4},${g >> 4},${b >> 4}`);
  }
  assert(max - min > 30, `Canvas contrast too low: ${max - min}`);
  assert(buckets.size > 24, `Canvas color detail too low: ${buckets.size} buckets`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await installStaticBundleRoute(page);
  await page.goto('http://bumper-hearts.test/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 8);

  assert.equal(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state), 'welcome');
  assert.equal(await page.locator('#modal-primary').textContent(), 'Begin story');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'modal-primary');
  const waitingTime = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0);
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0), waitingTime);
  await page.keyboard.press('KeyR');
  assert.equal(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state), 'welcome');

  await page.locator('#modal-primary').click();
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'story');
  assert.equal(await page.locator('#modal-primary').textContent(), 'Start stage 1');
  assert.equal(await page.locator('#cutscene-frame').getAttribute('data-sequence'), '0');
  assert.equal(await page.locator('#cutscene-art').getAttribute('src'), '/assets/story-anime/scene-00.webp');
  await page.locator('#modal-primary').click();
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'playing');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'game-canvas');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.entities.importedCars ?? 0) === 5, undefined, { timeout: 20_000 });

  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.player.velocity.x ?? 0) > 1);
  await page.keyboard.up('ArrowRight');
  assert((await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.yaw ?? 0)) < -0.4, 'Right steering has incorrect visual heading');

  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.mode === 'cockpit');
  assert.equal(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.playerVisualVisible), true);
  assert((await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.carForwardAlignment ?? 0)) > 0.98);
  await page.keyboard.press('KeyR');
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.player.yaw ?? 0) < -0.4);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.player.velocity.x ?? 0) > 1);
  await page.keyboard.up('KeyW');
  await page.locator('#camera-button').click();
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.mode === 'overhead');

  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'paused');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'modal-primary');
  const pausedTime = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0);
  await page.waitForTimeout(220);
  assert(Math.abs((await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0)) - pausedTime) < 0.02);
  await page.locator('#modal-primary').click();
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'playing');

  assertCanvasIsDetailed(await page.locator('#game-canvas').screenshot());
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  process.stdout.write('Release verification passed: welcome, controls, pause, imported cars, assets, and rendered canvas.\n');
} finally {
  await browser.close();
}

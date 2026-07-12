import { expect, test } from '@playwright/test';

test('pause freezes the round clock and restart resets the run', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  const initial = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0);
  await page.waitForTimeout(250);
  const running = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0);
  expect(running).toBeLessThan(initial);

  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('paused');
  const paused = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0);
  await page.waitForTimeout(300);
  const stillPaused = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0);
  expect(Math.abs(stillPaused - paused)).toBeLessThan(0.02);

  await page.keyboard.press('KeyR');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('playing');
  const reset = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  expect(reset?.score).toBe(0);
  expect(reset?.timeLeft ?? 0).toBeGreaterThan(69.4);
  expect(reset?.physics.engine).toBe('custom-arcade');
  expect(reset?.entities.rivals).toBe(4);
});

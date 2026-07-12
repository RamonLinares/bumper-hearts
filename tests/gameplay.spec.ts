import { expect, test } from '@playwright/test';

async function startRide(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /Begin story|Continue story/ }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('story');
  await page.getByRole('button', { name: /Start stage/ }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('playing');
}

test('opens on a welcome screen and waits for the rider', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ten nights at the pavilion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin story' })).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('welcome');
  const waiting = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0);
  await page.waitForTimeout(300);
  const stillWaiting = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0);
  expect(Math.abs(stillWaiting - waiting)).toBeLessThan(0.02);
  await page.keyboard.press('KeyR');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('welcome');
  await page.getByRole('button', { name: 'Begin story' }).click();
  await expect(page.locator('#story-dialogue')).toContainText('museum');
  await expect(page.locator('#cutscene-frame')).toHaveAttribute('data-sequence', '0');
  await expect(page.locator('#cutscene-art')).toHaveAttribute('src', '/assets/story-anime/scene-00.webp');
  await page.keyboard.press('KeyP');
  await page.keyboard.press('KeyR');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('story');
  await page.getByRole('button', { name: 'Start stage 1' }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('playing');
  await expect(page.locator('#game-canvas')).toBeFocused();
});

test('pause freezes the round clock and restart resets the run', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  await startRide(page);
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
  expect(reset?.timeLeft ?? 0).toBeGreaterThan(74.4);
  expect(reset?.physics.engine).toBe('custom-arcade');
  expect(reset?.entities.rivals).toBe(2);
  expect(reset?.campaign.stageNumber).toBe(1);
});

test('car nose follows left and right steering instead of reversing', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  await startRide(page);

  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.velocity.x ?? 0)).toBeGreaterThan(1);
  await page.keyboard.up('ArrowRight');
  const rightYaw = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.yaw ?? 0);
  expect(rightYaw).toBeLessThan(-0.4);

  await page.keyboard.down('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.velocity.x ?? 0)).toBeLessThan(-1);
  await page.keyboard.up('ArrowLeft');
  const leftYaw = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.yaw ?? 0);
  expect(leftYaw).toBeGreaterThan(0.4);
});

test('camera switches between overhead and first-person views', async ({ page }) => {
  await page.goto('/');
  await startRide(page);
  const cameraButton = page.getByRole('button', { name: 'Switch to first-person view' });
  await expect(cameraButton).toBeVisible();
  expect((await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__))?.camera).toMatchObject({
    mode: 'overhead',
    playerVisualVisible: true,
  });

  await page.keyboard.press('KeyC');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.mode)).toBe('cockpit');
  const cockpit = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  expect(cockpit?.camera.fov ?? 0).toBeGreaterThan(63);
  expect(cockpit?.camera.playerVisualVisible).toBe(true);
  expect(cockpit?.camera.carForwardAlignment ?? 0).toBeGreaterThan(0.98);
  expect((cockpit?.camera.position.y ?? 0) - (cockpit?.player.position.y ?? 0)).toBeGreaterThan(1.5);
  await expect(page.getByRole('button', { name: 'Switch to overhead view' })).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('KeyR');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.mode)).toBe('cockpit');
  await page.getByRole('button', { name: 'Switch to overhead view' }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.mode)).toBe('overhead');
  const overhead = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  expect(overhead?.camera.fov ?? 100).toBeLessThan(49);
  expect(overhead?.camera.playerVisualVisible).toBe(true);
});

test('first-person controls are relative to the car heading', async ({ page }) => {
  await page.goto('/');
  await startRide(page);
  await page.keyboard.press('KeyC');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.controlMode)).toBe('vehicle');

  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.velocity.z ?? 0)).toBeLessThan(-1);
  await page.keyboard.up('KeyW');

  await page.keyboard.press('KeyR');
  await expect.poll(() => page.evaluate(() => Math.abs(window.__THREE_GAME_DIAGNOSTICS__?.player.speed ?? 1))).toBeLessThan(0.05);
  await page.keyboard.down('KeyD');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.yaw ?? 0)).toBeLessThan(-0.4);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.velocity.x ?? 0)).toBeGreaterThan(1);
  await page.keyboard.up('ArrowUp');

  await page.keyboard.press('KeyR');
  await expect.poll(() => page.evaluate(() => Math.abs(window.__THREE_GAME_DIAGNOSTICS__?.player.yaw ?? 1))).toBeLessThan(0.05);
  await page.keyboard.down('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.yaw ?? 0)).toBeGreaterThan(0.4);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.velocity.x ?? 0)).toBeLessThan(-1);
  await page.keyboard.up('KeyW');

  await page.keyboard.press('KeyR');
  await page.keyboard.down('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.velocity.z ?? 0)).toBeGreaterThan(1);
  await page.keyboard.up('ArrowDown');
});

test('stage clear advances the story and loss retries the same chapter', async ({ page }) => {
  await page.goto('/');
  await startRide(page);
  await page.evaluate(() => window.__BUMPER_HEARTS_TEST_HOOKS__?.completeStage());
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('story');
  const clear = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  expect(clear?.campaign.completedStages).toBe(1);
  expect(clear?.campaign.storyPhase).toBe('outro');
  expect(clear?.campaign.connection).toBe('First spark');
  await expect(page.locator('#cutscene-frame')).toHaveAttribute('data-sequence', '1');
  await expect(page.locator('#cutscene-art')).toHaveAttribute('src', '/assets/story-anime/scene-01.webp');
  await expect(page.getByRole('button', { name: 'Continue to stage 2' })).toBeFocused();
  const frozen = clear?.timeLeft ?? 0;
  await page.waitForTimeout(250);
  expect(Math.abs((await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.timeLeft ?? 0)) - frozen)).toBeLessThan(0.02);
  await page.keyboard.press('KeyR');
  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('story');

  await page.getByRole('button', { name: 'Continue to stage 2' }).click();
  await expect(page.locator('#chapter-label')).toContainText('Neon Homework');
  await page.getByRole('button', { name: 'Start stage 2' }).click();
  const stageTwo = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  expect(stageTwo?.campaign.stageNumber).toBe(2);
  expect(stageTwo?.targetScore).toBe(900);
  expect(stageTwo?.entities.rivals).toBe(3);
  expect(stageTwo?.score).toBe(0);

  await page.evaluate(() => window.__BUMPER_HEARTS_TEST_HOOKS__?.failStage());
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('lost');
  await page.getByRole('button', { name: 'Retry stage' }).click();
  const retried = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  expect(retried?.state).toBe('playing');
  expect(retried?.campaign.stageNumber).toBe(2);
  expect(retried?.timeLeft).toBe(75);
});

test('the final stage outro is shown before the campaign epilogue', async ({ page }) => {
  await page.goto('/');
  await startRide(page);
  for (let stage = 1; stage <= 10; stage += 1) {
    await page.evaluate(() => window.__BUMPER_HEARTS_TEST_HOOKS__?.completeStage());
    if (stage === 10) break;
    await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.campaign.storyPhase)).toBe('outro');
    await page.getByRole('button', { name: `Continue to stage ${stage + 1}` }).click();
    await page.getByRole('button', { name: `Start stage ${stage + 1}` }).click();
  }
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('story');
  const finalOutro = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  expect(finalOutro?.complete).toBe(false);
  expect(finalOutro?.campaign.stageNumber).toBe(10);
  expect(finalOutro?.campaign.storyPhase).toBe('outro');
  expect(finalOutro?.campaign.completedStages).toBe(10);
  await expect(page.locator('#cutscene-frame')).toHaveAttribute('data-sequence', '10');
  await expect(page.locator('#cutscene-art')).toHaveAttribute('src', '/assets/story-anime/scene-10.webp');
  await expect(page.locator('#story-dialogue')).toContainText('Cleanup starts');

  await page.locator('#modal-primary').click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state)).toBe('campaignComplete');
  const finale = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  expect(finale?.complete).toBe(true);
  expect(finale?.campaign.completedStages).toBe(10);
  await expect(page.locator('#cutscene-frame')).toHaveAttribute('data-sequence', '11');
  await expect(page.locator('#cutscene-art')).toHaveAttribute('src', '/assets/story-anime/scene-11.webp');
  await expect(page.locator('#story-dialogue')).toContainText('capacitors');
  await expect(page.getByRole('button', { name: 'Play the story again' })).toBeFocused();
});

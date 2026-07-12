import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const storage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

const {
  CAMPAIGN_EPILOGUE,
  CAMPAIGN_STAGES,
  clearCampaignProgress,
  getCutsceneFrame,
  loadCampaignProgress,
  saveCampaignProgress,
} = await import('../src/game/Campaign.ts');

assert.equal(CAMPAIGN_STAGES.length, 10, 'Campaign must contain ten stages');
assert.equal(new Set(CAMPAIGN_STAGES.map((stage) => stage.id)).size, 10, 'Stage ids must be unique');

for (const [index, stage] of CAMPAIGN_STAGES.entries()) {
  assert(stage.intro.dialogue && stage.outro.dialogue, `${stage.id} must have intro and outro dialogue`);
  assert(stage.rivalCount >= 2 && stage.rivalCount <= 4, `${stage.id} has an invalid rival count`);
  assert(stage.seconds >= 60, `${stage.id} is too short for the campaign pacing`);
  if (index > 0) {
    assert(stage.targetScore > CAMPAIGN_STAGES[index - 1].targetScore, `${stage.id} target must escalate`);
    assert(stage.difficulty.speedMultiplier >= CAMPAIGN_STAGES[index - 1].difficulty.speedMultiplier, `${stage.id} difficulty must not regress`);
  }
}

assert.deepEqual(loadCampaignProgress(), { completedStages: 0, campaignScore: 0 });
saveCampaignProgress({ completedStages: 4, campaignScore: 5230 });
assert.deepEqual(loadCampaignProgress(), { completedStages: 4, campaignScore: 5230 });

storage.set('bumper-hearts:campaign:v1', '{bad json');
assert.deepEqual(loadCampaignProgress(), { completedStages: 0, campaignScore: 0 });
storage.set('bumper-hearts:campaign:v1', JSON.stringify({ completedStages: 999, campaignScore: -12 }));
assert.deepEqual(loadCampaignProgress(), { completedStages: 10, campaignScore: 0 });
clearCampaignProgress();
assert.equal(storage.size, 0);

assert.deepEqual(CAMPAIGN_STAGES.filter((stage) => stage.bossRival).map((stage) => stage.id), ['golden-boy', 'last-dance']);
assert(CAMPAIGN_EPILOGUE.dialogue, 'Campaign epilogue must have dialogue');
assert.deepEqual(getCutsceneFrame(0, 'intro'), {
  image: 'assets/story-anime/scene-00.webp', sequence: 0,
});
assert.deepEqual(getCutsceneFrame(9, 'outro'), {
  image: 'assets/story-anime/scene-10.webp', sequence: 10,
});
assert.deepEqual(getCutsceneFrame(9, 'outro', true), {
  image: 'assets/story-anime/scene-11.webp', sequence: 11,
});
for (let sequence = 0; sequence < 12; sequence += 1) {
  const filename = `scene-${String(sequence).padStart(2, '0')}.webp`;
  const asset = await stat(resolve(import.meta.dirname, '..', 'public', 'assets', 'story-anime', filename));
  assert(asset.size > 400_000, `${filename} is unexpectedly small for a full-resolution cutscene`);
}
process.stdout.write('Campaign verification passed: 10 escalating stages, distinct final outro and epilogue frames, story beats, bosses, and resilient session progress.\n');

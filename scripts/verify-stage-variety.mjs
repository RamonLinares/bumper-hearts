import assert from 'node:assert/strict';

const { CAMPAIGN_STAGES } = await import('../src/game/Campaign.ts');

const EXPECTED_STAGE_COUNT = 10;
const ARENA_HALF_WIDTH = 11;
const ARENA_HALF_DEPTH = 7;
const PLAYER_SPAWN_CLEARANCE = 1.2;
const MIN_PICKUP_SEPARATION = 1.35;

assert.equal(
  CAMPAIGN_STAGES.length,
  EXPECTED_STAGE_COUNT,
  `Stage-variety verification expects ${EXPECTED_STAGE_COUNT} stages`,
);

const requireUnique = (values, label) => {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  assert.equal(
    new Set(values).size,
    EXPECTED_STAGE_COUNT,
    `${label} must be unique for every stage; duplicates: ${[...new Set(duplicates)].join(', ') || 'unknown'}`,
  );
};

const floorIds = CAMPAIGN_STAGES.map((stage) => stage.theme.floorPattern);
const dressingIds = CAMPAIGN_STAGES.map((stage) => stage.theme.dressing);
const collectibleKinds = CAMPAIGN_STAGES.map((stage) => stage.collectibles.kind);
const layoutSignatures = CAMPAIGN_STAGES.map((stage) =>
  stage.collectibles.positions
    .map(([x, z]) => `${Number(x).toFixed(2)},${Number(z).toFixed(2)}`)
    .join('|'),
);

requireUnique(floorIds, 'Floor pattern identifiers');
requireUnique(dressingIds, 'Stage dressing identities');
requireUnique(collectibleKinds, 'Collectible kinds');
requireUnique(layoutSignatures, 'Collectible layouts');

for (const stage of CAMPAIGN_STAGES) {
  const positions = stage.collectibles.positions;
  assert(stage.collectibles.name.trim(), `${stage.id} collectible must have a display name`);
  assert.match(stage.collectibles.color, /^#[\da-f]{6}$/i, `${stage.id} collectible color must be a six-digit hex color`);
  assert(positions.length >= 6, `${stage.id} needs at least six collectibles`);

  for (const [index, [x, z]] of positions.entries()) {
    assert(Number.isFinite(x) && Number.isFinite(z), `${stage.id} pickup ${index} has a non-finite position`);
    assert(Math.abs(x) <= ARENA_HALF_WIDTH - 0.7, `${stage.id} pickup ${index} is too close to the side rail`);
    assert(Math.abs(z) <= ARENA_HALF_DEPTH - 0.7, `${stage.id} pickup ${index} is too close to the end rail`);
    assert(Math.hypot(x, z) >= PLAYER_SPAWN_CLEARANCE, `${stage.id} pickup ${index} overlaps the player spawn`);

    for (let other = index + 1; other < positions.length; other += 1) {
      const [otherX, otherZ] = positions[other];
      assert(
        Math.hypot(x - otherX, z - otherZ) >= MIN_PICKUP_SEPARATION,
        `${stage.id} pickups ${index} and ${other} overlap or read as one object`,
      );
    }
  }
}

const matrix = CAMPAIGN_STAGES.map((stage, index) => ({
  stage: index + 1,
  id: stage.id,
  floor: stage.theme.floorPattern,
  dressing: stage.theme.dressing,
  collectible: stage.collectibles.kind,
  pickups: stage.collectibles.positions.length,
  layout: layoutSignatures[index],
}));

console.table(matrix);
process.stdout.write(
  'Stage-variety verification passed: 10 unique floors, dressings, collectible kinds, and playable layouts.\n',
);

/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  score: number;
  targetScore: number;
  complete: boolean;
  state: 'welcome' | 'story' | 'playing' | 'paused' | 'lost' | 'campaignComplete';
  timeLeft: number;
  campaign: {
    stageIndex: number;
    stageNumber: number;
    stageCount: number;
    stageId: string;
    stageTitle: string;
    completedStages: number;
    campaignScore: number;
    storyPhase: 'intro' | 'outro';
    connection: string;
    pressure: string;
    rivalCount: number;
    rivalSpeedMultiplier: number;
    bossRivalIndex: number | null;
    collectibleKind: string;
    collectibleName: string;
    pickupLayoutSignature: string;
  };
  world: { floorPattern: string; floorSource: 'authored-texture'; dressing: string; props: number; meshes: number };
  audio: {
    unlocked: boolean;
    effectsMuted: boolean;
    musicMuted: boolean;
    contextState: AudioContextState | 'unavailable';
    ambiencePlaying: boolean;
    musicPlaying: boolean;
    loadedAssets: number;
    manifestAssets: number;
    activeSources: number;
    lastCue: string | null;
  };
  physics: { engine: string; timestep: number; bodies: number; colliders: number; activeHits: number };
  input: { dash: boolean; boosting: boolean };
  combat: {
    playerHealth: number;
    playerMaxHealth: number;
    rivalsRemaining: number;
    eliminations: number;
    rivalHealth: { index: number; health: number; maxHealth: number }[];
    damageBoostTime: number;
    boostCharge: number;
  };
  entities: { rivals: number; importedCars: number; pickupsActive: number; importedPickupsReady: number; particles: number };
  powerUp: {
    active: boolean;
    type: 'repair' | 'overdrive' | 'shock' | null;
    spawnIn: number;
    expiresIn: number;
    position: { x: number; z: number } | null;
  };
  player: {
    position: { x: number; y: number; z: number };
    speed: number;
    velocity: { x: number; z: number };
    yaw: number;
    controlMode: 'arena' | 'vehicle';
  };
  camera: {
    mode: 'overhead' | 'cockpit';
    fov: number;
    position: { x: number; y: number; z: number };
    playerVisualVisible: boolean;
    forward: { x: number; y: number; z: number };
    carForwardAlignment: number;
  };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  render_game_to_text?: () => string;
  advanceTime?: (milliseconds: number) => void;
  __BUMPER_HEARTS_TEST_HOOKS__?: {
    completeStage: () => void;
    failStage: () => void;
    damagePlayer: (amount: number) => void;
    impactPlayer: (strength: number) => void;
    damageRival: (index: number, amount: number) => void;
    collectPowerUp: (type: 'repair' | 'overdrive' | 'shock') => void;
  };
}

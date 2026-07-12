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
  world: { floorPattern: string; dressing: string; props: number; meshes: number };
  audio: {
    unlocked: boolean;
    muted: boolean;
    contextState: AudioContextState | 'unavailable';
    ambiencePlaying: boolean;
    loadedAssets: number;
    manifestAssets: number;
    activeSources: number;
    lastCue: string | null;
  };
  physics: { engine: string; timestep: number; bodies: number; colliders: number; activeHits: number };
  input: { dash: boolean };
  entities: { rivals: number; importedCars: number; pickupsActive: number; particles: number };
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
  };
}

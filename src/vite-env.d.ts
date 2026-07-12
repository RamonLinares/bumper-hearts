/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  score: number;
  targetScore: number;
  complete: boolean;
  state: 'playing' | 'paused' | 'won' | 'lost';
  timeLeft: number;
  physics: { engine: string; timestep: number; bodies: number; colliders: number; activeHits: number };
  input: { dash: boolean };
  entities: { rivals: number; pickupsActive: number; particles: number };
  player: {
    position: { x: number; y: number; z: number };
    speed: number;
    velocity: { x: number; z: number };
    yaw: number;
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
}

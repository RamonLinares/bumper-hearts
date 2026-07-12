type AudioGroup = 'ui' | 'sfx' | 'ambience' | 'music';

type AudioAsset = {
  id: string;
  file: string;
  group: AudioGroup;
  loop?: boolean;
};

type Manifest = { assets: AudioAsset[] };

export type AudioDiagnostics = {
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

const MANIFEST_URL = `${import.meta.env.BASE_URL}assets/audio/manifest.json`;
const GROUP_LEVELS: Record<AudioGroup, number> = {
  ui: 0.55,
  sfx: 0.72,
  ambience: 0.24,
  music: 0.34,
};

export class AudioSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private readonly groupGains = new Map<AudioGroup, GainNode>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly assets = new Map<string, AudioAsset>();
  private readonly activeSources = new Set<AudioBufferSourceNode>();
  private readonly lastPlayed = new Map<string, number>();
  private ambienceSource: AudioBufferSourceNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private unlockPromise: Promise<void> | null = null;
  private unlocked = false;
  private disposed = false;
  private effectsMuted = this.readPreference('bumper-hearts-fx-muted');
  private musicMuted = this.readPreference('bumper-hearts-music-muted');
  private lastCue: string | null = null;
  private impactVariant = 0;
  private pickupVariant = 0;

  private readonly unlockFromGesture = () => void this.unlock();
  private readonly handleVisibility = () => {
    if (document.hidden) void this.context?.suspend();
    else if (this.unlocked) void this.context?.resume();
  };

  constructor() {
    window.addEventListener('click', this.unlockFromGesture, { passive: true });
    window.addEventListener('keydown', this.unlockFromGesture);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private readPreference(key: string): boolean {
    try { return localStorage.getItem(key) === 'true'; }
    catch { return false; }
  }

  async unlock(): Promise<void> {
    if (this.disposed) return;
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = this.initialize();
    return this.unlockPromise;
  }

  private async initialize(): Promise<void> {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.context.destination);

      (Object.keys(GROUP_LEVELS) as AudioGroup[]).forEach((group) => {
        const gain = this.context!.createGain();
        gain.gain.value = GROUP_LEVELS[group];
        if (group === 'music' && this.musicMuted) gain.gain.value = 0;
        if (group !== 'music' && this.effectsMuted) gain.gain.value = 0;
        gain.connect(this.masterGain!);
        this.groupGains.set(group, gain);
      });

      await this.context.resume();
      this.unlocked = true;
      window.removeEventListener('click', this.unlockFromGesture);
      window.removeEventListener('keydown', this.unlockFromGesture);
      await this.loadAssets();
      this.startAmbience();
      this.startMusic();
    } catch (error) {
      console.warn('Audio is unavailable; continuing silently.', error);
    }
  }

  private async loadAssets(): Promise<void> {
    if (!this.context) return;
    try {
      const response = await fetch(MANIFEST_URL);
      if (!response.ok) throw new Error(`Audio manifest returned ${response.status}`);
      const manifest = (await response.json()) as Manifest;
      await Promise.all(
        manifest.assets.map(async (asset) => {
          this.assets.set(asset.id, asset);
          try {
            const url = `${import.meta.env.BASE_URL}assets/audio/${asset.file}`;
            const audioResponse = await fetch(url);
            if (!audioResponse.ok) throw new Error(`${asset.id} returned ${audioResponse.status}`);
            const buffer = await this.context!.decodeAudioData(await audioResponse.arrayBuffer());
            this.buffers.set(asset.id, buffer);
          } catch (error) {
            console.warn(`Could not load audio asset: ${asset.id}`, error);
          }
        }),
      );
    } catch (error) {
      console.warn('Could not load audio manifest; continuing silently.', error);
    }
  }

  private play(id: string, volume = 1, cooldownMs = 0): AudioBufferSourceNode | null {
    if (!this.context || this.context.state !== 'running') return null;
    const buffer = this.buffers.get(id);
    const asset = this.assets.get(id);
    if (!buffer || !asset) return null;

    const now = performance.now();
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < cooldownMs) return null;
    this.lastPlayed.set(id, now);
    this.lastCue = id;

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = Math.max(0, volume);
    source.buffer = buffer;
    source.loop = Boolean(asset.loop);
    source.connect(gain).connect(this.groupGains.get(asset.group) ?? this.masterGain!);
    source.addEventListener('ended', () => this.activeSources.delete(source), { once: true });
    this.activeSources.add(source);
    source.start();
    return source;
  }

  private startAmbience(): void {
    if (this.ambienceSource || this.effectsMuted) return;
    this.ambienceSource = this.play('fairground-loop', 1);
  }

  private startMusic(): void {
    if (this.musicSource || this.musicMuted) return;
    this.musicSource = this.play('crash-for-you', 1);
  }

  private stopMusic(): void {
    if (!this.musicSource) return;
    this.musicSource.stop();
    this.activeSources.delete(this.musicSource);
    this.musicSource = null;
  }

  private stopAmbience(): void {
    if (!this.ambienceSource) return;
    this.ambienceSource.stop();
    this.activeSources.delete(this.ambienceSource);
    this.ambienceSource = null;
  }

  pickup(_index = 0): void {
    const id = `pickup-0${(this.pickupVariant++ % 2) + 1}`;
    this.play(id, 0.86, 45);
  }

  impact(strength: number): void {
    const id = `impact-0${(this.impactVariant++ % 2) + 1}`;
    this.play(id, Math.min(0.35 + strength * 0.065, 1), 65);
  }

  boost(): void { this.play('boost', 0.9, 180); }
  heavyImpact(): void { this.play('heavy-impact', 0.95, 90); }
  repairPowerUp(): void { this.play('repair-powerup', 0.9, 180); }
  overdrivePowerUp(): void { this.play('overdrive-powerup', 0.92, 180); }
  shockBomb(): void { this.play('shock-bomb', 1, 300); }
  carEliminated(): void { this.play('car-eliminated', 0.9, 260); }
  confirm(): void { this.play('ui-confirm', 0.8, 80); }
  error(): void { this.play('ui-error', 0.8, 160); }
  pauseCue(): void { this.play('ui-pause', 0.75, 120); }
  stageClear(): void { this.play('stage-clear', 0.95, 600); }
  stageFail(): void { this.play('stage-fail', 0.9, 600); }
  bossCue(): void { this.play('boss-cue', 0.95, 800); }

  async setPaused(paused: boolean): Promise<void> {
    if (!this.context) return;
    if (paused) await this.context.suspend();
    else if (this.unlocked) {
      await this.context.resume();
      this.startAmbience();
      this.startMusic();
    }
  }

  setEffectsMuted(muted: boolean): void {
    this.effectsMuted = muted;
    try { localStorage.setItem('bumper-hearts-fx-muted', String(muted)); } catch { /* Storage may be unavailable. */ }
    for (const group of ['ui', 'sfx', 'ambience'] as const) {
      const gain = this.groupGains.get(group);
      if (gain && this.context) gain.gain.setTargetAtTime(muted ? 0 : GROUP_LEVELS[group], this.context.currentTime, 0.02);
    }
    if (muted) this.stopAmbience(); else this.startAmbience();
  }

  toggleEffectsMuted(): boolean {
    this.setEffectsMuted(!this.effectsMuted);
    return this.effectsMuted;
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    try { localStorage.setItem('bumper-hearts-music-muted', String(muted)); } catch { /* Storage may be unavailable. */ }
    const gain = this.groupGains.get('music');
    if (gain && this.context) gain.gain.setTargetAtTime(muted ? 0 : GROUP_LEVELS.music, this.context.currentTime, 0.02);
    if (muted) this.stopMusic(); else this.startMusic();
  }

  toggleMusicMuted(): boolean {
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  areEffectsMuted(): boolean { return this.effectsMuted; }
  isMusicMuted(): boolean { return this.musicMuted; }

  get diagnostics(): AudioDiagnostics {
    return {
      unlocked: this.unlocked,
      effectsMuted: this.effectsMuted,
      musicMuted: this.musicMuted,
      contextState: this.context?.state ?? 'unavailable',
      ambiencePlaying: Boolean(this.ambienceSource) && !this.effectsMuted,
      musicPlaying: Boolean(this.musicSource) && !this.musicMuted,
      loadedAssets: this.buffers.size,
      manifestAssets: this.assets.size,
      activeSources: this.activeSources.size,
      lastCue: this.lastCue,
    };
  }

  setGroupVolume(group: AudioGroup, volume: number): void {
    const gain = this.groupGains.get(group);
    if (gain && this.context) {
      gain.gain.setTargetAtTime(Math.max(0, Math.min(volume, 1)), this.context.currentTime, 0.02);
    }
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('click', this.unlockFromGesture);
    window.removeEventListener('keydown', this.unlockFromGesture);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.activeSources.forEach((source) => source.stop());
    this.activeSources.clear();
    this.ambienceSource = null;
    this.musicSource = null;
    void this.context?.close();
    this.context = null;
  }
}

import {
  CAMPAIGN_EPILOGUE,
  getCutsceneFrame,
  type CampaignStage,
  type GameState,
  type StoryPhase,
} from '../game/Campaign';
import { assetUrl } from '../core/assetUrl';

export type HudViewModel = {
  state: GameState;
  score: number;
  target: number;
  timeLeft: number;
  stage: CampaignStage;
  stageNumber: number;
  stageCount: number;
  campaignScore: number;
  completedStages: number;
  storyPhase: StoryPhase;
  playerHealth: number;
  playerMaxHealth: number;
  rivalsRemaining: number;
  eliminations: number;
  boostCharge: number;
  damageBoostTime: number;
};

export class Hud {
  private readonly overlay = this.getElement('#state-overlay');
  private readonly hudRoot = this.getElement('#hud');
  private readonly touchControls = this.getElement('#touch-controls');
  private readonly scoreValue = this.getElement('#score-value');
  private readonly targetValue = this.getElement('#target-value');
  private readonly timerValue = this.getElement('#timer-value');
  private readonly stageValue = this.getElement('#hud-stage');
  private readonly statusLine = this.getElement('#status-line');
  private readonly objectiveLine = this.getElement('#objective-line');
  private readonly combatStatus = this.getElement('#combat-status');
  private readonly progressFill = this.getElement('#progress-fill');
  private readonly chapterMeta = this.getElement('#chapter-meta');
  private readonly chapterLabel = this.getElement('#chapter-label');
  private readonly stageLabel = this.getElement('#stage-label');
  private readonly cutsceneFrame = this.getElement('#cutscene-frame');
  private readonly cutsceneArt = this.getElement<HTMLImageElement>('#cutscene-art');
  private readonly storyLocation = this.getElement('#story-location');
  private readonly modalTitle = this.getElement('#modal-title');
  private readonly modalCopy = this.getElement('#modal-copy');
  private readonly modalScore = this.getElement('#modal-score');
  private readonly storyQuote = this.getElement('#story-quote');
  private readonly storyDialogue = this.getElement('#story-dialogue');
  private readonly storySpeaker = this.getElement('#story-speaker');
  private readonly connectionStatus = this.getElement('#connection-status');
  private readonly pressureStatus = this.getElement('#pressure-status');
  private readonly modalPrimary = this.getElement<HTMLButtonElement>('#modal-primary');
  private readonly modalSecondary = this.getElement<HTMLButtonElement>('#modal-secondary');

  update(view: HudViewModel): void {
    const { state, timeLeft, stage, stageNumber, stageCount } = view;
    this.scoreValue.textContent = `${Math.ceil(view.playerHealth)}%`;
    this.targetValue.textContent = 'MAX';
    this.stageValue.textContent = `Stage ${String(stageNumber).padStart(2, '0')}`;
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = Math.ceil(timeLeft % 60).toString().padStart(2, '0');
    this.timerValue.textContent = `${minutes}:${seconds}`;
    this.progressFill.style.setProperty('--progress', `${Math.min(100, view.playerHealth / view.playerMaxHealth * 100)}%`);
    this.progressFill.style.setProperty('--health', `${view.playerHealth / view.playerMaxHealth}`);
    this.progressFill.style.background = view.playerHealth > 55
      ? 'linear-gradient(90deg, #4e9f9b, #65d4ca)'
      : view.playerHealth > 25
        ? 'linear-gradient(90deg, #e7ad43, #f5c45b)'
        : 'linear-gradient(90deg, #a82f43, #e65e72)';
    document.body.dataset.gameState = state;
    document.body.style.setProperty('--stage-accent', stage.theme.accent);

    const statusCopy: Record<GameState, string> = {
      welcome: 'Ten nights. One unforgettable summer.',
      story: `${stage.chapter} · ${stage.title}`,
      playing: `Last car standing • ${stage.title}`,
      paused: `Stage ${stageNumber} paused`,
      lost: 'Continue? The story is not over.',
      campaignComplete: 'The marquee shines again',
    };
    if (state === 'playing') {
      if (!this.objectiveLine.isConnected) this.statusLine.replaceChildren(this.objectiveLine, this.combatStatus);
      this.objectiveLine.textContent = 'Last car standing';
      this.combatStatus.textContent = `${view.rivalsRemaining} rival${view.rivalsRemaining === 1 ? '' : 's'} · Boost ${Math.round(view.boostCharge)}%${view.damageBoostTime > 0 ? ` · Overdrive ${view.damageBoostTime.toFixed(1)}s` : ''}`;
    } else this.statusLine.textContent = statusCopy[state];

    const overlayOpen = state !== 'playing';
    this.overlay.setAttribute('aria-hidden', String(!overlayOpen));
    this.overlay.inert = !overlayOpen;
    this.hudRoot.inert = overlayOpen;
    this.touchControls.inert = overlayOpen;
    if (!overlayOpen) return;

    const storyOpen = state === 'story' || state === 'campaignComplete';
    document.body.dataset.overlayKind = storyOpen ? 'story' : 'standard';
    this.chapterMeta.hidden = !storyOpen;
    this.cutsceneFrame.hidden = !storyOpen;
    this.storyQuote.hidden = !storyOpen;
    this.modalSecondary.hidden = true;
    this.overlay.setAttribute('aria-describedby', storyOpen ? 'modal-copy story-dialogue' : 'modal-copy');

    if (storyOpen) {
      const epilogue = state === 'campaignComplete';
      const beat = epilogue ? CAMPAIGN_EPILOGUE : stage[view.storyPhase];
      const cutscene = getCutsceneFrame(stageNumber - 1, view.storyPhase, epilogue);
      const sequenceChanged = this.cutsceneFrame.dataset.sequence !== String(cutscene.sequence);
      if (sequenceChanged) this.loadCutscene(cutscene.sequence, assetUrl(cutscene.image));
      this.storyLocation.textContent = epilogue ? 'Festival Night · Grand Marquee' : stage.location;
      this.chapterLabel.textContent = epilogue ? 'Epilogue · Last Ride' : `${stage.chapter} · ${stage.title}`;
      this.stageLabel.textContent = epilogue ? 'Story complete' : `${stage.location} · Stage ${stageNumber}/${stageCount}`;
      this.modalTitle.textContent = beat.headline;
      this.modalCopy.textContent = beat.narration;
      this.storyDialogue.textContent = `“${beat.dialogue}”`;
      this.storySpeaker.textContent = beat.speaker;
      this.connectionStatus.textContent = beat.connection;
      this.pressureStatus.textContent = beat.pressure;
      this.modalScore.textContent = epilogue
        ? `All ${stageCount} stages survived  ·  ${view.campaignScore.toLocaleString('en-US')} total knockouts`
        : view.storyPhase === 'intro'
        ? `Mission · Be the last car running · Survive ${stage.seconds} seconds${stage.bossRival ? ' · Rex joins the arena' : ''} · Green repairs · Gold overdrive · Blue shock bomb`
        : `Stage survived  ·  ${view.eliminations} knockouts  ·  ${Math.ceil(view.playerHealth)}% integrity remaining`;
      this.modalPrimary.textContent = epilogue
        ? 'Play the story again'
        : view.storyPhase === 'intro'
          ? `Start stage ${stageNumber}`
          : stageNumber === stageCount
            ? 'See the ending'
            : `Continue to stage ${stageNumber + 1}`;
      return;
    }

    this.chapterLabel.textContent = '';
    this.stageLabel.textContent = '';
    const hasProgress = view.completedStages > 0;
    if (state === 'welcome') {
      this.modalTitle.textContent = hasProgress ? 'The story continues' : 'Ten nights at the pavilion';
      this.modalCopy.textContent = hasProgress
        ? `${stage.chapter}: ${stage.title} is waiting under the lights.`
        : 'A patched bumper car, a brilliant lighting designer, and one last summer at the old fairground.';
      this.modalScore.textContent = hasProgress
        ? `${view.completedStages} of ${stageCount} stages cleared  ·  ${view.campaignScore.toLocaleString('en-US')} total joy`
        : `${stageCount} survival stages  ·  One summer story  ·  Progress saved for this session`;
      this.modalPrimary.textContent = hasProgress ? 'Continue story' : 'Begin story';
      this.modalSecondary.hidden = !hasProgress;
      this.modalSecondary.textContent = 'Restart from stage 1';
    } else if (state === 'paused') {
      this.modalTitle.textContent = 'Ride paused';
      this.modalCopy.textContent = `${stage.chapter}: ${stage.title} will wait.`;
      this.modalScore.textContent = `Integrity ${Math.ceil(view.playerHealth)}%  ·  ${view.rivalsRemaining} rivals remain  ·  Boost ${Math.round(view.boostCharge)}%`;
      this.modalPrimary.textContent = 'Resume';
      this.modalSecondary.hidden = false;
      this.modalSecondary.textContent = 'Restart stage';
    } else if (state === 'lost') {
      this.modalTitle.textContent = 'Continue?';
      this.modalCopy.textContent = 'Your car is out of the arena. Use angled hits, save boost for committed attacks, and fight for the repair pickups.';
      this.modalScore.textContent = `Stage ${stageNumber}  ·  ${view.eliminations} knockouts  ·  ${view.rivalsRemaining} rivals survived`;
      this.modalPrimary.textContent = 'Retry stage';
    }
  }

  flashImpact(): void {
    this.statusLine.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', color: '#fff0a8' }, { transform: 'scale(1)' }],
      { duration: 180, easing: 'ease-out' },
    );
  }

  flashPickup(): void {
    this.statusLine.animate(
      [
        { transform: 'translateY(0)', color: '#fff0c2' },
        { transform: 'translateY(-3px)', color: '#f5c45b' },
        { transform: 'translateY(0)', color: '#fff0c2' },
      ],
      { duration: 220, easing: 'ease-out' },
    );
  }

  private loadCutscene(sequence: number, source: string): void {
    const sequenceKey = String(sequence);
    this.cutsceneFrame.dataset.sequence = sequenceKey;
    this.cutsceneFrame.classList.add('is-loading');

    const reveal = () => {
      if (this.cutsceneFrame.dataset.sequence !== sequenceKey) return;
      this.cutsceneFrame.classList.remove('is-loading');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && this.cutsceneArt.animate) {
        this.cutsceneArt.animate(
          [{ opacity: 0, transform: 'scale(1.025)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      }
    };

    this.cutsceneArt.onload = reveal;
    this.cutsceneArt.onerror = reveal;
    this.cutsceneArt.src = source;
    if (this.cutsceneArt.complete) void this.cutsceneArt.decode().then(reveal).catch(reveal);
  }

  private getElement<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing HUD element: ${selector}`);
    return element;
  }
}

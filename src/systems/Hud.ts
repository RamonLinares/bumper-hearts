export class Hud {
  private readonly scoreValue = this.getElement('#score-value');
  private readonly targetValue = this.getElement('#target-value');
  private readonly timerValue = this.getElement('#timer-value');
  private readonly statusLine = this.getElement('#status-line');
  private readonly progressFill = this.getElement('#progress-fill');
  private readonly modalTitle = this.getElement('#modal-title');
  private readonly modalCopy = this.getElement('#modal-copy');
  private readonly modalScore = this.getElement('#modal-score');
  private readonly modalPrimary = this.getElement<HTMLButtonElement>('#modal-primary');
  private readonly modalSecondary = this.getElement<HTMLButtonElement>('#modal-secondary');

  setTarget(target: number): void {
    this.targetValue.textContent = String(target);
  }

  update(score: number, target: number, timeLeft: number, state: 'playing' | 'paused' | 'won' | 'lost'): void {
    this.scoreValue.textContent = String(score).padStart(6, '0');
    this.targetValue.textContent = String(target);
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = Math.ceil(timeLeft % 60).toString().padStart(2, '0');
    this.timerValue.textContent = `${minutes}:${seconds}`;
    this.progressFill.style.setProperty('--progress', `${Math.min(100, score / target * 100)}%`);
    const copy = {
      playing: 'Bump rivals • collect memories',
      paused: 'A tiny intermission',
      won: 'The whole pavilion is glowing!',
      lost: 'The bulbs are dimming — one more ride?',
    };
    this.statusLine.textContent = copy[state];
    document.body.dataset.gameState = state;
    if (state !== 'playing') {
      const modal = {
        paused: {
          title: 'Tiny intermission',
          copy: 'The little lights will wait for you.',
          primary: 'Keep riding',
          secondary: 'Start fresh',
        },
        won: {
          title: 'You lit up the fair!',
          copy: 'Every tiny bulb remembers that wonderful ride.',
          primary: 'Ride again',
          secondary: 'Fresh ticket',
        },
        lost: {
          title: 'Lights out… for now',
          copy: 'The pocket fairground saved a ticket just for you.',
          primary: 'One more ride',
          secondary: 'Start fresh',
        },
      }[state];
      this.modalTitle.textContent = modal.title;
      this.modalCopy.textContent = modal.copy;
      this.modalPrimary.textContent = modal.primary;
      this.modalSecondary.textContent = modal.secondary;
      this.modalScore.textContent = state === 'paused' ? `Joy ${String(score).padStart(6, '0')}` : `Final joy · ${String(score).padStart(6, '0')} / ${target}`;
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

  private getElement<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing HUD element: ${selector}`);
    return element;
  }
}

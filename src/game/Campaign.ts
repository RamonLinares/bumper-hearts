export type GameState = 'welcome' | 'story' | 'playing' | 'paused' | 'lost' | 'campaignComplete';
export type StoryPhase = 'intro' | 'outro';

export type RivalDifficulty = {
  speedMultiplier: number;
  chaseRadius: number;
  chaseChance: number;
  steeringResponse: number;
  decisionScale: number;
};

export type StoryBeat = {
  headline: string;
  narration: string;
  speaker: 'Dot' | 'Eli' | 'Maya' | 'Rex';
  dialogue: string;
  connection: string;
  pressure: string;
};

export type CutsceneFrame = {
  image: string;
  sequence: number;
};

export type CampaignStage = {
  id: string;
  chapter: string;
  title: string;
  location: string;
  seconds: number;
  targetScore: number;
  rivalCount: number;
  bossRival?: { index: number; scale: number };
  difficulty: RivalDifficulty;
  theme: { accent: string; floorTint: string; fog: string };
  intro: StoryBeat;
  outro: StoryBeat;
};

export type CampaignProgress = {
  completedStages: number;
  campaignScore: number;
};

const difficulty = (
  speedMultiplier: number,
  chaseRadius: number,
  chaseChance: number,
  steeringResponse: number,
  decisionScale: number,
): RivalDifficulty => ({ speedMultiplier, chaseRadius, chaseChance, steeringResponse, decisionScale });

export const CAMPAIGN_STAGES: readonly CampaignStage[] = [
  {
    id: 'first-ticket', chapter: 'Chapter I', title: 'First Ticket', location: 'Friday, 7:42 PM · West Pavilion',
    seconds: 75, targetScore: 700, rivalCount: 2, difficulty: difficulty(0.82, 5.8, 0.38, 1.9, 1.22),
    theme: { accent: '#f5c45b', floorTint: '#fff2d0', fog: '#25314a' },
    intro: { headline: 'A machine worth saving', narration: 'The fair is closing when Dot rolls a patched little car out of storage. Its antenna leans left. So does Eli.', speaker: 'Dot', dialogue: 'That car belongs in a museum. Try not to become part of the exhibit.', connection: 'Unnoticed', pressure: 'Quiet' },
    outro: { headline: 'A first spark', narration: 'Maya kneels beside the smoking dashboard and repairs one loose lead before Eli can find his words.', speaker: 'Maya', dialogue: 'Your steering is terrible. Your circuitry isn’t.', connection: 'First spark', pressure: 'Noticed' },
  },
  {
    id: 'neon-homework', chapter: 'Chapter II', title: 'Neon Homework', location: 'Monday, 8:15 PM · School Night',
    seconds: 75, targetScore: 900, rivalCount: 3, difficulty: difficulty(0.88, 6.4, 0.46, 2.05, 1.12),
    theme: { accent: '#62b8d2', floorTint: '#e4f6f4', fog: '#203b52' },
    intro: { headline: 'Follow the pattern', narration: 'Maya has programmed the pavilion lights to pulse like a circuit diagram above the ride. Eli recognizes her handiwork immediately.', speaker: 'Maya', dialogue: 'I designed tonight’s pattern. Try to keep up, circuit boy.', connection: 'Curious', pressure: 'Watching' },
    outro: { headline: 'Same frequency', narration: 'The final bulbs land perfectly on the beat. Maya is still smiling when Rex arrives at the balcony rail.', speaker: 'Maya', dialogue: 'Okay. That was actually impressive.', connection: 'Curious', pressure: 'Watching' },
  },
  {
    id: 'mixed-signals', chapter: 'Chapter III', title: 'Mixed Signals', location: 'Thursday, 8:53 PM · Radio Club Night',
    seconds: 72, targetScore: 1050, rivalCount: 3, difficulty: difficulty(0.94, 7.1, 0.54, 2.2, 1.02),
    theme: { accent: '#9b83c6', floorTint: '#eee8fa', fog: '#332b50' },
    intro: { headline: 'Static on the line', narration: 'Rex parks his gold car across Eli’s path. Maya folds her arms before he can finish the joke.', speaker: 'Maya', dialogue: 'I can answer for myself, Rex.', connection: 'Listening', pressure: 'Irritated' },
    outro: { headline: 'No small talk required', narration: 'Maya asks about the homemade dash controller. Ten minutes later they are arguing happily about capacitor tolerances.', speaker: 'Eli', dialogue: 'Wait—you actually know why the relay keeps burning out?', connection: 'Listening', pressure: 'Irritated' },
  },
  {
    id: 'date-disaster', chapter: 'Chapter IV', title: 'Date Night Disaster', location: 'Saturday, 9:06 PM · Café Pavilion',
    seconds: 70, targetScore: 1200, rivalCount: 4, difficulty: difficulty(1, 7.7, 0.62, 2.35, 0.96),
    theme: { accent: '#e96b62', floorTint: '#ffe7dc', fog: '#4b3039' },
    intro: { headline: 'Wrong place, right ticket', narration: 'Eli arrives with a replacement fuse during Maya and Rex’s expensive-looking date. Rex buys him a ticket to make him look foolish.', speaker: 'Rex', dialogue: 'One round. Let’s see what the little science project can do.', connection: 'Amused', pressure: 'Rising' },
    outro: { headline: 'The better rescue', narration: 'Eli abandons an easy pickup to bump a stranded driver free. Maya laughs with him while Rex waits to be noticed.', speaker: 'Maya', dialogue: 'You know that cost you the perfect run, right? Good choice.', connection: 'Amused', pressure: 'Rising' },
  },
  {
    id: 'golden-boy', chapter: 'Chapter V', title: 'The Golden Boy', location: 'Sunday, 9:30 PM · Sponsor’s Cup',
    seconds: 74, targetScore: 1350, rivalCount: 4, bossRival: { index: 2, scale: 1.16 }, difficulty: difficulty(1.07, 8.2, 0.68, 2.5, 0.9),
    theme: { accent: '#e7ad43', floorTint: '#fff0c9', fog: '#4a3928' },
    intro: { headline: 'Rex enters the arena', narration: 'The sponsor’s son unveils a gold-plated car and a crew of hired drivers. Maya looks considerably less impressed than the crowd.', speaker: 'Rex', dialogue: 'One ride. Then you disappear.', connection: 'Concerned', pressure: 'Confrontation' },
    outro: { headline: 'No one’s kingdom', narration: 'Rex orders Maya to leave. She stays beside Eli’s damaged car and reaches for the toolbox.', speaker: 'Maya', dialogue: 'This is a bumper ride, Rex—not your kingdom.', connection: 'Trusting', pressure: 'Confrontation' },
  },
  {
    id: 'after-hours', chapter: 'Chapter VI', title: 'After-Hours Frequency', location: 'Tuesday, 11:14 PM · Lights-Out Test',
    seconds: 70, targetScore: 1450, rivalCount: 4, difficulty: difficulty(1.12, 8.7, 0.73, 2.65, 0.86),
    theme: { accent: '#58b8b1', floorTint: '#dff4ee', fog: '#173d46' },
    intro: { headline: 'A private test', narration: 'Maya slips Eli a hand-drawn timing chart. The pavilion belongs to the two of them for one midnight calibration run.', speaker: 'Maya', dialogue: 'I need a driver who understands what the lights are saying.', connection: 'Trusting', pressure: 'Suspicious' },
    outro: { headline: 'Perfect synchronization', narration: 'Her lights flare at the exact moment Eli finishes the run. For a second, neither of them lets go of the control rail.', speaker: 'Maya', dialogue: 'You make this place feel possible again.', connection: 'Close', pressure: 'Suspicious' },
  },
  {
    id: 'blackout-blitz', chapter: 'Chapter VII', title: 'Blackout Blitz', location: 'Friday, 10:02 PM · Summer Storm',
    seconds: 72, targetScore: 1550, rivalCount: 4, difficulty: difficulty(1.17, 9.1, 0.78, 2.8, 0.82),
    theme: { accent: '#83b7e8', floorTint: '#dce8f5', fog: '#14253d' },
    intro: { headline: 'When the power fails', narration: 'Rex’s overloaded display trips the pavilion. Maya climbs into the control booth while Eli bumps the stranded cars back into motion.', speaker: 'Maya', dialogue: 'Keep them moving. I’ll bring the grid back one row at a time.', connection: 'A team', pressure: 'Boiling' },
    outro: { headline: 'The lights return', narration: 'The crowd cheers both names. Maya publicly credits Eli; Rex hears every word through the emergency speakers.', speaker: 'Dot', dialogue: 'Looks like the two of you make a dangerous circuit.', connection: 'A team', pressure: 'Boiling' },
  },
  {
    id: 'rumor-mill', chapter: 'Chapter VIII', title: 'Rumor Mill Rally', location: 'Saturday, 6:40 PM · School Fair',
    seconds: 70, targetScore: 1650, rivalCount: 4, difficulty: difficulty(1.22, 9.5, 0.82, 2.95, 0.78),
    theme: { accent: '#d95e68', floorTint: '#f8e1e5', fog: '#4a2734' },
    intro: { headline: 'A convenient accusation', narration: 'Rex claims Eli sabotaged the pavilion. Maya checks the logs instead of accepting the story—and finds Rex’s access card.', speaker: 'Maya', dialogue: 'Facts first. Drama later.', connection: 'Certain', pressure: 'Exposed' },
    outro: { headline: 'Her decision', narration: 'Maya ends the relationship because Rex lied and tried to control her. Eli says nothing until she chooses to speak.', speaker: 'Maya', dialogue: 'I’m not anyone’s trophy, Rex. This is over.', connection: 'Certain', pressure: 'Exposed' },
  },
  {
    id: 'heart-to-heart', chapter: 'Chapter IX', title: 'Heart-to-Heart', location: 'Sunday, 8:18 PM · Sunset Session',
    seconds: 72, targetScore: 1775, rivalCount: 4, difficulty: difficulty(1.27, 10, 0.86, 3.1, 0.74),
    theme: { accent: '#ef8a6b', floorTint: '#ffe2d1', fog: '#553246' },
    intro: { headline: 'Finish the sentence', narration: 'Eli attempts a confession and produces a detailed explanation of high-voltage capacitors instead.', speaker: 'Maya', dialogue: 'Finish the ride. Then finish that sentence.', connection: 'Almost there', pressure: 'Final warning' },
    outro: { headline: 'At last, plain language', narration: 'Eli finally says it. Maya looks relieved rather than surprised—and asks him on a real date.', speaker: 'Maya', dialogue: 'Good. I was getting tired of waiting.', connection: 'Mutual', pressure: 'Final warning' },
  },
  {
    id: 'last-dance', chapter: 'Chapter X', title: 'Last Dance at the Pavilion', location: 'Festival Night, 10:30 PM · Grand Marquee',
    seconds: 80, targetScore: 1900, rivalCount: 4, bossRival: { index: 2, scale: 1.24 }, difficulty: difficulty(1.33, 10.5, 0.9, 3.25, 0.7),
    theme: { accent: '#f5c45b', floorTint: '#fff0c2', fog: '#372a46' },
    intro: { headline: 'One final grandstand', narration: 'Rex arrives in an upgraded gold car. Above him, Maya and Eli reveal the marquee they rebuilt together.', speaker: 'Rex', dialogue: 'This pavilion still has my family’s name on it.', connection: 'Together', pressure: 'Finale' },
    outro: { headline: 'The golden boy comes down', narration: 'Rex loses the final ride and offers an awkward apology. Dot accepts it—then hands him a broom and points toward the arena.', speaker: 'Dot', dialogue: 'Apology accepted. Cleanup starts by the west rail.', connection: 'Together', pressure: 'Released' },
  },
] as const;

export const CAMPAIGN_EPILOGUE: StoryBeat = {
  headline: 'The last ride',
  narration: 'Beneath the restored marquee, Maya chooses the first song and takes the wheel. Eli finally stops talking long enough to enjoy the moment.',
  speaker: 'Maya',
  dialogue: 'Come on, circuit boy. You promised me one ride without talking about capacitors.',
  connection: 'Together',
  pressure: 'Released',
};

export function getCutsceneFrame(stageIndex: number, phase: StoryPhase, epilogue = false): CutsceneFrame {
  const sequence = epilogue ? 11 : Math.min(10, Math.max(0, stageIndex + (phase === 'outro' ? 1 : 0)));
  return {
    image: `assets/story-anime/scene-${String(sequence).padStart(2, '0')}.webp`,
    sequence,
  };
}

const STORAGE_KEY = 'bumper-hearts:campaign:v1';

export function loadCampaignProgress(): CampaignProgress {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<CampaignProgress>;
    return {
      completedStages: Math.min(CAMPAIGN_STAGES.length, Math.max(0, Math.floor(Number(parsed.completedStages) || 0))),
      campaignScore: Math.max(0, Math.floor(Number(parsed.campaignScore) || 0)),
    };
  } catch {
    return { completedStages: 0, campaignScore: 0 };
  }
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* Storage may be unavailable in private contexts. */ }
}

export function clearCampaignProgress(): void {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable in private contexts. */ }
}

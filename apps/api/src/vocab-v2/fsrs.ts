import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from 'ts-fsrs';

const scheduler = fsrs(generatorParameters({
  request_retention: 0.9,
  enable_fuzz: false,
  learning_steps: [],
  relearning_steps: [],
}));

export interface V2ScheduleState {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: Date | null;
  createdAt: Date;
}

export function scheduleV2Review(
  current: V2ScheduleState | null,
  correct: boolean | 'good' | 'hard' | 'again',
  now = new Date(),
) {
  const card: Card = !current || (current.reps === 0 && !current.lastReview)
    ? createEmptyCard(current?.createdAt ?? now)
    : ({
        due: current.due,
        stability: current.stability,
        difficulty: current.difficulty,
        elapsed_days: current.elapsedDays,
        scheduled_days: current.scheduledDays,
        reps: current.reps,
        lapses: current.lapses,
        state: State.Review,
        last_review: current.lastReview ?? undefined,
        learning_steps: 0,
      } as unknown as Card);
  const rating = correct === 'hard' ? Rating.Hard : correct === true || correct === 'good' ? Rating.Good : Rating.Again;
  const next = scheduler.repeat(card, now)[rating].card;
  return {
    due: next.due,
    stability: next.stability,
    difficulty: next.difficulty,
    elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    lastReview: now,
  };
}

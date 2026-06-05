import { useEffect, useState } from 'react';
import { OUTCOME, resolveOutcome } from '@/lib/game-view';
import { RESULT } from '@/types/events';
import { useGameStore } from '@/stores/gameStore';
import { useSocketStore } from '@/stores/socketStore';

/** Countdown seconds before the room closes, matching the server's 10s cleanup window */
const COUNTDOWN_SECONDS = 10;

/** Milliseconds per countdown tick, naming the interval to avoid a magic number */
const MS_PER_SECOND = 1000;

/** Display copy per outcome, for the result headline */
const OUTCOME_TEXT = {
  [OUTCOME.WIN]: 'You Win! 🎉',
  [OUTCOME.LOSE]: 'You Lose',
  [OUTCOME.DRAW]: "It's a Draw",
} as const;

/** Result overlay, shown on a terminal game state with a countdown back to the lobby */
export const ResultOverlay = () => {
  const state = useGameStore((s) => s.state);
  const mySymbol = useSocketStore((s) => s.mySymbol);
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  const isTerminal = state !== null && state.result !== RESULT.IN_PROGRESS;

  // Tick a cosmetic countdown while terminal; the server's room:closed does the actual navigation
  useEffect(() => {
    if (!isTerminal) {
      setSeconds(COUNTDOWN_SECONDS);
      return;
    }
    const timer = setInterval(() => setSeconds((prev) => (prev > 0 ? prev - 1 : 0)), MS_PER_SECOND);
    return () => clearInterval(timer);
  }, [isTerminal]);

  // Render nothing until the game actually ends
  if (!isTerminal || mySymbol === null || state === null) {
    return null;
  }

  const outcome = resolveOutcome(state.result, mySymbol);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
      <h2 className="text-3xl font-bold">{OUTCOME_TEXT[outcome]}</h2>
      <p className="text-sm text-white/80">Returning to lobby in {seconds}s…</p>
    </div>
  );
};

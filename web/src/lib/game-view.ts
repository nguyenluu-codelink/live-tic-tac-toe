import { RESULT, SYMBOL, type GameResult, type GameStatePayload, type PlayerSymbol } from '@/types/events';

/** Player-perspective outcomes, for choosing the result-screen message */
export const OUTCOME = {
  WIN: 'WIN',
  LOSE: 'LOSE',
  DRAW: 'DRAW',
} as const;

export type Outcome = (typeof OUTCOME)[keyof typeof OUTCOME];

/** Map a server result to this player's perspective, for showing win/lose/draw */
export const resolveOutcome = (result: GameResult, mySymbol: PlayerSymbol): Outcome => {
  // A forfeit always means the remaining (this) player wins
  if (result === RESULT.OPPONENT_LEFT) {
    return OUTCOME.WIN;
  }
  if (result === RESULT.DRAW) {
    return OUTCOME.DRAW;
  }
  // Compare the winning symbol against mine to decide win vs lose
  const winningSymbol = result === RESULT.X_WINS ? SYMBOL.X : SYMBOL.O;
  return winningSymbol === mySymbol ? OUTCOME.WIN : OUTCOME.LOSE;
};

/** Decide if it is this player's turn, gating on IN_PROGRESS so terminal turn values never enable input */
export const isMyTurn = (state: GameStatePayload, mySymbol: PlayerSymbol): boolean =>
  state.result === RESULT.IN_PROGRESS && state.turn === mySymbol;

import { describe, expect, it } from 'vitest';
import { RESULT, SYMBOL, type GameStatePayload } from '@/types/events';
import { isMyTurn, OUTCOME, resolveOutcome } from './game-view';

/** A small helper, for building a game-state fixture without repeating fields */
const stateOf = (turn: GameStatePayload['turn'], result: GameStatePayload['result']): GameStatePayload => ({
  board: Array(9).fill(null),
  turn,
  result,
});

describe('resolveOutcome', () => {
  it('returns WIN for the player whose symbol won', () => {
    expect(resolveOutcome(RESULT.X_WINS, SYMBOL.X)).toBe(OUTCOME.WIN);
    expect(resolveOutcome(RESULT.O_WINS, SYMBOL.O)).toBe(OUTCOME.WIN);
  });

  it('returns LOSE for the player whose symbol lost', () => {
    expect(resolveOutcome(RESULT.X_WINS, SYMBOL.O)).toBe(OUTCOME.LOSE);
    expect(resolveOutcome(RESULT.O_WINS, SYMBOL.X)).toBe(OUTCOME.LOSE);
  });

  it('returns DRAW for a drawn game regardless of symbol', () => {
    expect(resolveOutcome(RESULT.DRAW, SYMBOL.X)).toBe(OUTCOME.DRAW);
    expect(resolveOutcome(RESULT.DRAW, SYMBOL.O)).toBe(OUTCOME.DRAW);
  });

  it('returns WIN on forfeit, since the remaining player wins', () => {
    expect(resolveOutcome(RESULT.OPPONENT_LEFT, SYMBOL.X)).toBe(OUTCOME.WIN);
    expect(resolveOutcome(RESULT.OPPONENT_LEFT, SYMBOL.O)).toBe(OUTCOME.WIN);
  });
});

describe('isMyTurn', () => {
  it('is true only when the game is in progress and the turn matches my symbol', () => {
    expect(isMyTurn(stateOf(SYMBOL.X, RESULT.IN_PROGRESS), SYMBOL.X)).toBe(true);
    expect(isMyTurn(stateOf(SYMBOL.O, RESULT.IN_PROGRESS), SYMBOL.X)).toBe(false);
  });

  it('is false in a terminal state even when turn matches my symbol', () => {
    // turn holds the last mover in terminal states, so it must never enable input
    expect(isMyTurn(stateOf(SYMBOL.X, RESULT.X_WINS), SYMBOL.X)).toBe(false);
  });
});

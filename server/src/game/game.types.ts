import { PlayerSymbol, GameResult, MoveError } from './game.constants';

/** A single board cell: a player symbol or empty */
export type Cell = PlayerSymbol | null;

/** Immutable snapshot of a game, broadcast to clients to render.
 *  When result !== IN_PROGRESS, `turn` holds the last player who moved (not meaningful for routing). */
export type GameState = {
  board: readonly Cell[];
  turn: PlayerSymbol;
  result: GameResult;
};

/** Discriminated result of applying a move, for explicit error handling without exceptions */
export type MoveOutcome =
  | { ok: true; state: GameState }
  | { ok: false; error: MoveError };

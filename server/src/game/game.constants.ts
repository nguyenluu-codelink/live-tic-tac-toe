/** Player symbol values, single source of truth for cell + turn states */
export const SYMBOL = {
  X: 'X',
  O: 'O',
} as const;

export type PlayerSymbol = (typeof SYMBOL)[keyof typeof SYMBOL];

/** Game outcomes, for signalling end-of-game to clients (OPPONENT_LEFT set only on forfeit) */
export const RESULT = {
  IN_PROGRESS: 'IN_PROGRESS',
  X_WINS: 'X_WINS',
  O_WINS: 'O_WINS',
  DRAW: 'DRAW',
  OPPONENT_LEFT: 'OPPONENT_LEFT',
} as const;

export type GameResult = (typeof RESULT)[keyof typeof RESULT];

/** Move rejection reasons, returned to the gateway to emit typed errors */
export const MOVE_ERROR = {
  GAME_OVER: 'GAME_OVER',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  CELL_OUT_OF_RANGE: 'CELL_OUT_OF_RANGE',
  CELL_TAKEN: 'CELL_TAKEN',
} as const;

export type MoveError = (typeof MOVE_ERROR)[keyof typeof MOVE_ERROR];

/** Number of cells on the board, to avoid magic numbers */
export const BOARD_SIZE = 9;

/** All winning index triples, for win detection */
export const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
] as const;

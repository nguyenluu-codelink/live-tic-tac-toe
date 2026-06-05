import { SYMBOL, RESULT, MOVE_ERROR, BOARD_SIZE, WIN_LINES, PlayerSymbol, GameResult } from './game.constants';
import { Cell, GameState, MoveOutcome } from './game.types';

/** Create a fresh game (empty board, X to move) for starting a new match */
export const createGame = (): GameState => ({
  board: Array<Cell>(BOARD_SIZE).fill(null),
  turn: SYMBOL.X,
  result: RESULT.IN_PROGRESS,
});

/** Find the winning symbol on a board, used to detect end-of-game */
const findWinner = (board: Cell[]): PlayerSymbol | null => {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
};

/** Map a winning symbol to a result, keeping derivation in one place */
const resultForWinner = (winner: PlayerSymbol): GameResult =>
  winner === SYMBOL.X ? RESULT.X_WINS : RESULT.O_WINS;

/** Compute the next turn symbol, for alternating play */
const nextTurn = (current: PlayerSymbol): PlayerSymbol =>
  current === SYMBOL.X ? SYMBOL.O : SYMBOL.X;

/** Apply a move for a symbol at a cell, validating turn/cell rules for server authority */
export const applyMove = (state: GameState, symbol: PlayerSymbol, cell: number): MoveOutcome => {
  // Reject moves after the game has ended, for correct end-state handling
  if (state.result !== RESULT.IN_PROGRESS) {
    return { ok: false, error: MOVE_ERROR.GAME_OVER };
  }
  // Enforce turn order so only the active player can move
  if (symbol !== state.turn) {
    return { ok: false, error: MOVE_ERROR.NOT_YOUR_TURN };
  }
  // Guard the cell index, to prevent out-of-bounds writes
  if (cell < 0 || cell >= BOARD_SIZE) {
    return { ok: false, error: MOVE_ERROR.CELL_OUT_OF_RANGE };
  }
  // Reject overwriting an occupied cell, to keep the board valid
  if (state.board[cell] !== null) {
    return { ok: false, error: MOVE_ERROR.CELL_TAKEN };
  }

  // Copy the board, to keep state immutable for predictable rendering
  const board = [...state.board];
  board[cell] = symbol;

  // Determine the new result after placing the symbol
  const winner = findWinner(board);
  if (winner !== null) {
    return { ok: true, state: { board, turn: symbol, result: resultForWinner(winner) } };
  }
  // Declare a draw when the board is full with no winner
  if (board.every((c) => c !== null)) {
    return { ok: true, state: { board, turn: symbol, result: RESULT.DRAW } };
  }
  // Otherwise advance to the other player's turn
  return { ok: true, state: { board, turn: nextTurn(symbol), result: RESULT.IN_PROGRESS } };
};

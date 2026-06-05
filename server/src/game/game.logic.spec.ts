import { SYMBOL, RESULT, BOARD_SIZE, MOVE_ERROR } from './game.constants';
import { GameState, MoveOutcome } from './game.types';
import { createGame, applyMove } from './game.logic';

/** Narrow a successful outcome to its state, failing the test otherwise */
const expectOk = (outcome: MoveOutcome): GameState => {
  if (!outcome.ok) {
    throw new Error(`expected ok move, got ${outcome.error}`);
  }
  return outcome.state;
};

describe('createGame', () => {
  it('starts with an empty board, X to move, in progress', () => {
    const state = createGame();
    expect(state.board).toHaveLength(BOARD_SIZE);
    expect(state.board.every((c) => c === null)).toBe(true);
    expect(state.turn).toBe(SYMBOL.X);
    expect(state.result).toBe(RESULT.IN_PROGRESS);
  });
});

describe('applyMove (valid)', () => {
  it('places the symbol and passes the turn', () => {
    const next = expectOk(applyMove(createGame(), SYMBOL.X, 4));
    expect(next.board[4]).toBe(SYMBOL.X);
    expect(next.turn).toBe(SYMBOL.O);
    expect(next.result).toBe(RESULT.IN_PROGRESS);
  });

  it('does not mutate the input state', () => {
    const start = createGame();
    applyMove(start, SYMBOL.X, 0);
    expect(start.board[0]).toBeNull();
    expect(start.turn).toBe(SYMBOL.X);
  });
});

describe('applyMove (end of game)', () => {
  it('detects X winning across the top row', () => {
    let s = createGame();
    s = expectOk(applyMove(s, SYMBOL.X, 0)); // X
    s = expectOk(applyMove(s, SYMBOL.O, 3)); // O
    s = expectOk(applyMove(s, SYMBOL.X, 1)); // X
    s = expectOk(applyMove(s, SYMBOL.O, 4)); // O
    s = expectOk(applyMove(s, SYMBOL.X, 2)); // X completes 0,1,2
    expect(s.result).toBe(RESULT.X_WINS);
  });

  it('detects O winning down a diagonal', () => {
    let s = createGame();
    s = expectOk(applyMove(s, SYMBOL.X, 1));
    s = expectOk(applyMove(s, SYMBOL.O, 0));
    s = expectOk(applyMove(s, SYMBOL.X, 2));
    s = expectOk(applyMove(s, SYMBOL.O, 4));
    s = expectOk(applyMove(s, SYMBOL.X, 5));
    s = expectOk(applyMove(s, SYMBOL.O, 8)); // O completes 0,4,8
    expect(s.result).toBe(RESULT.O_WINS);
  });

  it('detects X winning down the left column', () => {
    let s = createGame();
    // X:0,3,6 (left column); O:1,2 — no O win line before X finishes
    s = expectOk(applyMove(s, SYMBOL.X, 0));
    s = expectOk(applyMove(s, SYMBOL.O, 1));
    s = expectOk(applyMove(s, SYMBOL.X, 3));
    s = expectOk(applyMove(s, SYMBOL.O, 2));
    s = expectOk(applyMove(s, SYMBOL.X, 6)); // X completes 0,3,6
    expect(s.result).toBe(RESULT.X_WINS);
  });

  it('detects O winning on the anti-diagonal', () => {
    let s = createGame();
    // O:2,4,6 (anti-diagonal); X:0,1,3 — no X win line before O finishes
    s = expectOk(applyMove(s, SYMBOL.X, 0));
    s = expectOk(applyMove(s, SYMBOL.O, 2));
    s = expectOk(applyMove(s, SYMBOL.X, 1));
    s = expectOk(applyMove(s, SYMBOL.O, 4));
    s = expectOk(applyMove(s, SYMBOL.X, 3));
    s = expectOk(applyMove(s, SYMBOL.O, 6)); // O completes 2,4,6
    expect(s.result).toBe(RESULT.O_WINS);
  });

  it('detects a draw when the board fills with no winner', () => {
    let s = createGame();
    const moves: [typeof SYMBOL.X | typeof SYMBOL.O, number][] = [
      [SYMBOL.X, 0], [SYMBOL.O, 1], [SYMBOL.X, 2],
      [SYMBOL.O, 5], [SYMBOL.X, 3], [SYMBOL.O, 6],
      [SYMBOL.X, 4], [SYMBOL.O, 8], [SYMBOL.X, 7],
    ];
    for (const [symbol, cell] of moves) {
      s = expectOk(applyMove(s, symbol, cell));
    }
    expect(s.result).toBe(RESULT.DRAW);
  });

  it('detects X winning across the middle row', () => {
    let s = createGame();
    s = expectOk(applyMove(s, SYMBOL.X, 3));
    s = expectOk(applyMove(s, SYMBOL.O, 0));
    s = expectOk(applyMove(s, SYMBOL.X, 4));
    s = expectOk(applyMove(s, SYMBOL.O, 1));
    s = expectOk(applyMove(s, SYMBOL.X, 5)); // X completes 3,4,5
    expect(s.result).toBe(RESULT.X_WINS);
  });

  it('detects X winning across the bottom row', () => {
    let s = createGame();
    s = expectOk(applyMove(s, SYMBOL.X, 6));
    s = expectOk(applyMove(s, SYMBOL.O, 0));
    s = expectOk(applyMove(s, SYMBOL.X, 7));
    s = expectOk(applyMove(s, SYMBOL.O, 1));
    s = expectOk(applyMove(s, SYMBOL.X, 8)); // X completes 6,7,8
    expect(s.result).toBe(RESULT.X_WINS);
  });

  it('detects X winning down the middle column', () => {
    let s = createGame();
    s = expectOk(applyMove(s, SYMBOL.X, 1));
    s = expectOk(applyMove(s, SYMBOL.O, 0));
    s = expectOk(applyMove(s, SYMBOL.X, 4));
    s = expectOk(applyMove(s, SYMBOL.O, 2));
    s = expectOk(applyMove(s, SYMBOL.X, 7)); // X completes 1,4,7
    expect(s.result).toBe(RESULT.X_WINS);
  });

  it('detects X winning down the right column', () => {
    let s = createGame();
    s = expectOk(applyMove(s, SYMBOL.X, 2));
    s = expectOk(applyMove(s, SYMBOL.O, 0));
    s = expectOk(applyMove(s, SYMBOL.X, 5));
    s = expectOk(applyMove(s, SYMBOL.O, 1));
    s = expectOk(applyMove(s, SYMBOL.X, 8)); // X completes 2,5,8
    expect(s.result).toBe(RESULT.X_WINS);
  });
});

/** Narrow a failed outcome to its error, failing the test otherwise */
const expectError = (outcome: MoveOutcome) => {
  if (outcome.ok) {
    throw new Error('expected move to be rejected');
  }
  return outcome.error;
};

describe('applyMove (errors)', () => {
  it('rejects a move by the wrong player', () => {
    expect(expectError(applyMove(createGame(), SYMBOL.O, 0))).toBe(MOVE_ERROR.NOT_YOUR_TURN);
  });

  it('rejects a move on a taken cell', () => {
    const after = expectOk(applyMove(createGame(), SYMBOL.X, 0));
    expect(expectError(applyMove(after, SYMBOL.O, 0))).toBe(MOVE_ERROR.CELL_TAKEN);
  });

  it('rejects an out-of-range cell', () => {
    expect(expectError(applyMove(createGame(), SYMBOL.X, 9))).toBe(MOVE_ERROR.CELL_OUT_OF_RANGE);
  });

  it('rejects a move after the game is over', () => {
    let s = createGame();
    s = expectOk(applyMove(s, SYMBOL.X, 0));
    s = expectOk(applyMove(s, SYMBOL.O, 3));
    s = expectOk(applyMove(s, SYMBOL.X, 1));
    s = expectOk(applyMove(s, SYMBOL.O, 4));
    s = expectOk(applyMove(s, SYMBOL.X, 2)); // X wins
    expect(expectError(applyMove(s, SYMBOL.O, 5))).toBe(MOVE_ERROR.GAME_OVER);
  });
});

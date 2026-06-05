import { cn } from '@/lib/utils';
import { isMyTurn } from '@/lib/game-view';
import { sendMove } from '@/services/socket';
import { useGameStore } from '@/stores/gameStore';
import { useSocketStore } from '@/stores/socketStore';

/** Game board, rendering the 3x3 grid and sending taps when it is the player's turn */
export const GameBoard = () => {
  const state = useGameStore((s) => s.state);
  const mySymbol = useSocketStore((s) => s.mySymbol);

  // Without a state snapshot or symbol there is nothing to render yet
  if (state === null || mySymbol === null) {
    return null;
  }

  const myTurn = isMyTurn(state, mySymbol);

  /** Send a move for an empty cell only on the player's turn, enforcing the client-side gate */
  const handleCellClick = (index: number) => {
    if (!myTurn || state.board[index] !== null) {
      return;
    }
    sendMove(index);
  };

  return (
    <div className="grid aspect-square w-full max-w-md grid-cols-3 gap-2">
      {state.board.map((cell, index) => (
        <button
          key={index}
          // Disable cells that are filled or not the player's to play
          disabled={!myTurn || cell !== null}
          onClick={() => handleCellClick(index)}
          className={cn(
            'flex items-center justify-center rounded-lg border-2 text-5xl font-bold transition-colors',
            cell === null && myTurn ? 'hover:bg-accent' : '',
            'disabled:cursor-default',
          )}
        >
          {cell}
        </button>
      ))}
    </div>
  );
};

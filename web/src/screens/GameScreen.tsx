import { GameBoard } from '@/components/GameBoard';
import { PlayerStatus } from '@/components/PlayerStatus';
import { ResultOverlay } from '@/components/ResultOverlay';
import { TopBar } from '@/components/TopBar';
import { VideoFeeds } from '@/components/VideoFeeds';
import { SYMBOL } from '@/types/events';
import { useGameStore } from '@/stores/gameStore';
import { useSocketStore } from '@/stores/socketStore';

/** Game screen, composing the sketch layout: top bar, player rows, 75% board, 25% video */
export const GameScreen = () => {
  const state = useGameStore((s) => s.state);
  const mySymbol = useSocketStore((s) => s.mySymbol);
  const playerName = useSocketStore((s) => s.playerName);
  const opponentName = useSocketStore((s) => s.opponentName);

  // Guard the invariant that mySymbol is set on the game screen, so symbol logic below is non-null
  if (mySymbol === null) {
    return null;
  }

  // Identify which symbol is mine vs the opponent's for the status rows
  const opponentSymbol = mySymbol === SYMBOL.X ? SYMBOL.O : SYMBOL.X;
  const activeSymbol = state?.turn ?? null;

  return (
    // Relative container so the result overlay can cover the whole screen
    <div className="relative flex h-full flex-col">
      <TopBar />

      {/* Player status rows show names, symbols and the active turn */}
      <div className="space-y-2 p-3">
        <PlayerStatus
          name={playerName}
          symbol={mySymbol}
          isActive={activeSymbol === mySymbol}
          isYou
        />
        <PlayerStatus
          name={opponentName ?? 'Waiting…'}
          symbol={opponentSymbol}
          isActive={activeSymbol === opponentSymbol}
          isYou={false}
        />
      </div>

      {/* Board takes ~75% of the remaining height */}
      <div className="flex flex-[3] items-center justify-center p-3">
        <GameBoard />
      </div>

      {/* Video feeds take ~25% of the remaining height */}
      <div className="flex-1 p-3 pt-0">
        <VideoFeeds />
      </div>

      <ResultOverlay />
    </div>
  );
};

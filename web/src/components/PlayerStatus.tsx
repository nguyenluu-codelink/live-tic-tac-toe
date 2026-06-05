import { cn } from '@/lib/utils';
import type { PlayerSymbol } from '@/types/events';

/** PlayerStatus props, describing one player row's name/symbol/turn state for the header */
type PlayerStatusProps = {
  name: string;
  symbol: PlayerSymbol;
  isActive: boolean;
  isYou: boolean;
};

/** A single player status row, showing whose turn it is for clear game feedback */
export const PlayerStatus = ({ name, symbol, isActive, isYou }: PlayerStatusProps) => (
  <div
    className={cn(
      'flex items-center justify-between rounded-md px-3 py-2',
      // Highlight the active player's row so turn ownership is obvious
      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted',
    )}
  >
    <span className="font-medium">
      {name} {isYou && '(You)'}
    </span>
    <span className="flex items-center gap-2 text-sm">
      <span className="font-bold">{symbol}</span>
      {/* Phrase the turn label from this row's perspective, so the opponent row reads correctly */}
      {isActive && <span>• {isYou ? 'Your turn' : 'Their turn'}</span>}
    </span>
  </div>
);

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { leaveRoom } from '@/services/socket';
import { useSocketStore } from '@/stores/socketStore';

/** Top bar, showing the menu (leave) action and the player avatar per the sketch layout */
export const TopBar = () => {
  const playerName = useSocketStore((state) => state.playerName);
  // First letter of the name as a simple avatar, to avoid asset dependencies
  const initial = playerName.charAt(0).toUpperCase();

  return (
    <div className="flex items-center justify-between border-b p-3">
      {/* Hamburger doubles as a leave-room action for this minimal demo */}
      <Button variant="ghost" size="icon" aria-label="Leave room" onClick={leaveRoom}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
        {initial}
      </div>
    </div>
  );
};

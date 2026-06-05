import { useEffect } from 'react';
import { toast } from 'sonner';
import { GameScreen } from '@/screens/GameScreen';
import { LobbyScreen } from '@/screens/LobbyScreen';
import { NameEntryScreen } from '@/screens/NameEntryScreen';
import { SCREEN, useSocketStore } from '@/stores/socketStore';

/** Human-readable messages per server error code, for friendly toasts */
const ERROR_MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: 'That room no longer exists.',
  ROOM_FULL: 'That room is already full.',
  ALREADY_IN_ROOM: 'You are already in that room.',
  NAME_REQUIRED: 'A name is required.',
  CELL_OUT_OF_RANGE: 'Invalid move.',
  NOT_YOUR_TURN: "It's not your turn.",
  CELL_TAKEN: 'That cell is already taken.',
  GAME_OVER: 'The game is already over.',
};

/** Root app, selecting the active screen and surfacing server errors as toasts */
const App = () => {
  const screen = useSocketStore((state) => state.screen);

  // Listen for the socket layer's error CustomEvent and show a toast, decoupling UI from the service
  useEffect(() => {
    const handler = (event: Event) => {
      const code = (event as CustomEvent<string>).detail;
      toast.error(ERROR_MESSAGES[code] ?? 'Something went wrong.');
    };
    window.addEventListener('app-error', handler);
    return () => window.removeEventListener('app-error', handler);
  }, []);

  // Map the current screen to its component
  if (screen === SCREEN.GAME) {
    return <GameScreen />;
  }
  if (screen === SCREEN.LOBBY) {
    return <LobbyScreen />;
  }
  return <NameEntryScreen />;
};

export default App;

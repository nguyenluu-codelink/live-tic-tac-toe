import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type { PlayerSymbol, RoomSummary } from '@/types/events';

/** App screens, the single source of truth for top-level navigation */
export const SCREEN = {
  NAME: 'NAME',
  LOBBY: 'LOBBY',
  GAME: 'GAME',
} as const;

export type Screen = (typeof SCREEN)[keyof typeof SCREEN];

/** Connection, identity, lobby and room state, holding everything the socket layer drives */
type SocketState = {
  socket: Socket | null;
  screen: Screen;
  connected: boolean;
  playerName: string;
  roomId: string | null;
  mySymbol: PlayerSymbol | null;
  opponentName: string | null;
  rooms: RoomSummary[];
  setSocket: (socket: Socket) => void;
  setScreen: (screen: Screen) => void;
  setConnected: (connected: boolean) => void;
  setPlayerName: (name: string) => void;
  enterRoom: (roomId: string, symbol: PlayerSymbol) => void;
  setOpponentName: (name: string) => void;
  setRooms: (rooms: RoomSummary[]) => void;
  addRoom: (room: RoomSummary) => void;
  removeRoom: (id: string) => void;
  resetRoom: () => void;
};

/** Socket store, for connection status, identity, lobby list and current-room info */
export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  screen: SCREEN.NAME,
  connected: false,
  playerName: '',
  roomId: null,
  mySymbol: null,
  opponentName: null,
  rooms: [],
  setSocket: (socket) => set({ socket }),
  setScreen: (screen) => set({ screen }),
  setConnected: (connected) => set({ connected }),
  setPlayerName: (playerName) => set({ playerName }),
  // Enter the game screen with the assigned room id and symbol
  enterRoom: (roomId, mySymbol) => set({ roomId, mySymbol, screen: SCREEN.GAME }),
  setOpponentName: (opponentName) => set({ opponentName }),
  setRooms: (rooms) => set({ rooms }),
  // Append a room, de-duplicating by id so repeated broadcasts do not stack
  addRoom: (room) =>
    set((state) => ({
      rooms: state.rooms.some((r) => r.id === room.id) ? state.rooms : [...state.rooms, room],
    })),
  removeRoom: (id) => set((state) => ({ rooms: state.rooms.filter((r) => r.id !== id) })),
  // Clear room-scoped state when returning to the lobby
  resetRoom: () => set({ roomId: null, mySymbol: null, opponentName: null }),
}));

import { create } from 'zustand';
import type { GameStatePayload } from '@/types/events';

/** Authoritative game snapshot, holding only what the board + result overlay render */
type GameState = {
  state: GameStatePayload | null;
  setState: (state: GameStatePayload) => void;
  reset: () => void;
};

/** Game store, for the server-authoritative board/turn/result snapshot */
export const useGameStore = create<GameState>((set) => ({
  state: null,
  setState: (state) => set({ state }),
  reset: () => set({ state: null }),
}));

import { PlayerSymbol } from '../game/game.constants';
import { GameState } from '../game/game.types';
import { RoomError } from './room.constants';

/** A connected player in a room, keyed by socket id for routing + disconnect handling */
export type Player = {
  socketId: string;
  name: string;
  symbol: PlayerSymbol;
};

/** Full server-side room state, the source of truth for a match */
export type Room = {
  id: string;
  name: string;
  players: Player[];
  game: GameState | null;
};

/** Lightweight room info for the lobby list, hiding internal game state */
export type RoomSummary = {
  id: string;
  name: string;
  hostName: string;
};

/** Discriminated result for join attempts, for explicit error handling */
export type JoinOutcome =
  | { ok: true; room: Room }
  | { ok: false; error: RoomError };

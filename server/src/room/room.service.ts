import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SYMBOL } from '../game/game.constants';
import { createGame, applyMove } from '../game/game.logic';
import { MoveOutcome } from '../game/game.types';
import { MAX_PLAYERS, ROOM_ERROR } from './room.constants';
import { JoinOutcome, Player, Room, RoomSummary } from './room.types';

/** In-memory room registry + lifecycle, the authoritative store for the demo (no DB by design) */
@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, Room>();

  /** Create a room with its creator as X, for hosting a new match */
  createRoom(name: string, creatorSocketId: string, creatorName: string): Room {
    const host: Player = { socketId: creatorSocketId, name: creatorName, symbol: SYMBOL.X };
    const room: Room = { id: randomUUID(), name, players: [host], game: null };
    this.rooms.set(room.id, room);
    return room;
  }

  /** List rooms still awaiting an opponent, for the lobby view */
  listOpenRooms(): RoomSummary[] {
    const open: RoomSummary[] = [];
    for (const room of this.rooms.values()) {
      if (room.players.length < MAX_PLAYERS) {
        open.push({ id: room.id, name: room.name, hostName: room.players[0].name });
      }
    }
    return open;
  }

  /** Join an open room as O and start the game, for pairing the second player */
  joinRoom(roomId: string, socketId: string, name: string): JoinOutcome {
    const room = this.rooms.get(roomId);
    if (room === undefined) {
      return { ok: false, error: ROOM_ERROR.NOT_FOUND };
    }
    // Reject a socket already in this room, to prevent a player joining their own/again
    if (room.players.some((p) => p.socketId === socketId)) {
      return { ok: false, error: ROOM_ERROR.ALREADY_IN_ROOM };
    }
    if (room.players.length >= MAX_PLAYERS) {
      return { ok: false, error: ROOM_ERROR.FULL };
    }
    const joiner: Player = { socketId, name, symbol: SYMBOL.O };
    room.players.push(joiner);
    room.game = createGame();
    return { ok: true, room };
  }

  /** Look up the room a socket belongs to, for routing moves/signaling/disconnect */
  getRoomBySocket(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) {
        return room;
      }
    }
    return undefined;
  }

  /** Apply a move from a socket, enforcing authority via the game logic.
   *  Returns undefined when the socket has no room or no active game;
   *  returns { room, outcome } where outcome.ok is false if the move itself was rejected. */
  applyMoveBySocket(socketId: string, cell: number): { room: Room; outcome: MoveOutcome } | undefined {
    const room = this.getRoomBySocket(socketId);
    if (room === undefined || room.game === null) {
      return undefined;
    }
    const player = room.players.find((p) => p.socketId === socketId);
    if (player === undefined) {
      return undefined;
    }
    const outcome = applyMove(room.game, player.symbol, cell);
    if (outcome.ok) {
      room.game = outcome.state;
    }
    return { room, outcome };
  }

  /** Remove a room from the registry, for cleanup after a game ends */
  removeRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  /** Handle a disconnect as a forfeit, returning the room + remaining player for notification */
  handleDisconnect(socketId: string): { room: Room; remaining: Player | undefined } | undefined {
    const room = this.getRoomBySocket(socketId);
    if (room === undefined) {
      return undefined;
    }
    const remaining = room.players.find((p) => p.socketId !== socketId);
    this.rooms.delete(room.id);
    return { room, remaining };
  }
}

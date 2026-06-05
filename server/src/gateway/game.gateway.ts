import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MOVE_ERROR, RESULT } from '../game/game.constants';
import { GAME_END_CLEANUP_MS, ROOM_ERROR } from '../room/room.constants';
import { RoomService } from '../room/room.service';
import { EVENT, EventName } from './events.constants';

/** Single Socket.IO gateway wiring lobby, game moves, and WebRTC signaling for the demo */
@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(private readonly rooms: RoomService) {}

  /** Send the current open-room list to one client, for populating the lobby */
  @SubscribeMessage(EVENT.LOBBY_LIST)
  handleLobbyList(@ConnectedSocket() client: Socket): void {
    client.emit(EVENT.LOBBY_LIST, this.rooms.listOpenRooms());
  }

  /** Create a room and announce it, for hosting a new match */
  @SubscribeMessage(EVENT.ROOM_CREATE)
  handleRoomCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { name: string; playerName: string },
  ): void {
    // Reject incomplete payloads, to avoid creating nameless rooms/players
    if (!body?.name || !body?.playerName) {
      client.emit(EVENT.ERROR, { code: ROOM_ERROR.NAME_REQUIRED });
      return;
    }
    const room = this.rooms.createRoom(body.name, client.id, body.playerName);
    client.join(room.id);
    client.emit(EVENT.ROOM_JOINED, { roomId: room.id, symbol: room.players[0].symbol });
    // Broadcast so every lobby list stays live
    this.server.emit(EVENT.ROOM_CREATED, { id: room.id, name: room.name, hostName: body.playerName });
  }

  /** Join a room, start the game, and trigger signaling, for pairing the second player */
  @SubscribeMessage(EVENT.ROOM_JOIN)
  handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; playerName: string },
  ): void {
    // Reject an incomplete join payload, to give a clear error instead of a misleading NOT_FOUND
    if (!body?.roomId || !body?.playerName) {
      client.emit(EVENT.ERROR, { code: ROOM_ERROR.NAME_REQUIRED });
      return;
    }
    const outcome = this.rooms.joinRoom(body.roomId, client.id, body.playerName);
    if (!outcome.ok) {
      client.emit(EVENT.ERROR, { code: outcome.error });
      return;
    }
    const room = outcome.room;
    client.join(room.id);
    const [host, joiner] = room.players;
    client.emit(EVENT.ROOM_JOINED, { roomId: room.id, symbol: joiner.symbol });
    // The room is no longer open: drop it from lobby lists
    this.server.emit(EVENT.ROOM_REMOVED, { id: room.id });
    // Tell both peers to begin the WebRTC handshake (host is the offerer)
    this.server.to(host.socketId).emit(EVENT.RTC_START, { initiator: true, opponentName: joiner.name });
    this.server.to(joiner.socketId).emit(EVENT.RTC_START, { initiator: false, opponentName: host.name });
    // Send the initial game state to both players
    this.server.to(room.id).emit(EVENT.GAME_STATE, room.game);
  }

  /** Apply a move and broadcast the new state, enforcing server authority */
  @SubscribeMessage(EVENT.GAME_MOVE)
  handleGameMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { cell: number },
  ): void {
    // Reject a malformed move payload, to avoid throwing on a missing cell
    if (body?.cell === undefined) {
      client.emit(EVENT.ERROR, { code: MOVE_ERROR.CELL_OUT_OF_RANGE });
      return;
    }
    const result = this.rooms.applyMoveBySocket(client.id, body.cell);
    if (result === undefined) {
      return;
    }
    if (!result.outcome.ok) {
      client.emit(EVENT.ERROR, { code: result.outcome.error });
      return;
    }
    const room = result.room;
    this.server.to(room.id).emit(EVENT.GAME_STATE, room.game);
    // On a finished game, announce the result and schedule cleanup
    if (room.game !== null && room.game.result !== RESULT.IN_PROGRESS) {
      this.server.to(room.id).emit(EVENT.GAME_OVER, { result: room.game.result });
      this.scheduleRoomCleanup(room.id);
    }
  }

  /** Relay a WebRTC offer to the other peer, for establishing the video connection */
  @SubscribeMessage(EVENT.RTC_OFFER)
  handleRtcOffer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): void {
    this.relayToPeer(client, EVENT.RTC_OFFER, body);
  }

  /** Relay a WebRTC answer to the other peer, for completing the handshake */
  @SubscribeMessage(EVENT.RTC_ANSWER)
  handleRtcAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): void {
    this.relayToPeer(client, EVENT.RTC_ANSWER, body);
  }

  /** Relay an ICE candidate to the other peer, for NAT traversal */
  @SubscribeMessage(EVENT.RTC_ICE)
  handleRtcIce(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): void {
    this.relayToPeer(client, EVENT.RTC_ICE, body);
  }

  /** Handle an explicit leave as a forfeit, for clean room teardown */
  @SubscribeMessage(EVENT.ROOM_LEAVE)
  handleRoomLeave(@ConnectedSocket() client: Socket): void {
    this.forfeit(client.id);
  }

  /** Handle a disconnect as a forfeit, for robustness when a player drops */
  handleDisconnect(client: Socket): void {
    this.forfeit(client.id);
  }

  /** Relay a signaling payload to the other player in the sender's room */
  private relayToPeer(client: Socket, event: EventName, body: unknown): void {
    const room = this.rooms.getRoomBySocket(client.id);
    if (room === undefined) {
      return;
    }
    const peer = room.players.find((p) => p.socketId !== client.id);
    if (peer === undefined) {
      return;
    }
    this.server.to(peer.socketId).emit(event, body);
  }

  /** Declare the remaining player the winner and tear down, for forfeit handling */
  private forfeit(socketId: string): void {
    const result = this.rooms.handleDisconnect(socketId);
    if (result === undefined) {
      return;
    }
    // Only a live game is a true forfeit; a finished game is already being cleaned up
    const gameInProgress = result.room.game !== null && result.room.game.result === RESULT.IN_PROGRESS;
    if (result.remaining !== undefined) {
      if (gameInProgress) {
        this.server.to(result.remaining.socketId).emit(EVENT.GAME_OVER, { result: RESULT.OPPONENT_LEFT });
      }
      this.server.to(result.remaining.socketId).emit(EVENT.ROOM_CLOSED, { id: result.room.id });
    }
    // Clear the now-removed room from any open lobby lists
    this.server.emit(EVENT.ROOM_REMOVED, { id: result.room.id });
  }

  /** Destroy a finished room after the result window, for memory cleanup */
  private scheduleRoomCleanup(roomId: string): void {
    setTimeout(() => {
      // Notify clients before removing the room, so the close event still routes to them
      this.server.to(roomId).emit(EVENT.ROOM_CLOSED, { id: roomId });
      this.rooms.removeRoom(roomId);
    }, GAME_END_CLEANUP_MS);
  }
}

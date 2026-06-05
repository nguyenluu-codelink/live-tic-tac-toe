import { SYMBOL, MOVE_ERROR } from '../game/game.constants';
import { RoomService } from './room.service';
import { ROOM_ERROR } from './room.constants';

describe('RoomService.createRoom / listOpenRooms', () => {
  it('creates a room with the creator as X and lists it as open', () => {
    const service = new RoomService();
    const room = service.createRoom('Mike\'s room', 'socket-1', 'Mike');

    expect(room.players).toHaveLength(1);
    expect(room.players[0].symbol).toBe(SYMBOL.X);
    expect(room.players[0].name).toBe('Mike');
    expect(room.game).toBeNull();

    const open = service.listOpenRooms();
    expect(open).toHaveLength(1);
    expect(open[0]).toEqual({ id: room.id, name: 'Mike\'s room', hostName: 'Mike' });
  });
});

describe('RoomService.joinRoom', () => {
  it('adds the joiner as O, starts the game, and hides the room from the lobby', () => {
    const service = new RoomService();
    const room = service.createRoom('room', 'socket-1', 'Host');

    const outcome = service.joinRoom(room.id, 'socket-2', 'Guest');
    if (!outcome.ok) {
      throw new Error(`expected join to succeed, got ${outcome.error}`);
    }
    expect(outcome.room.players).toHaveLength(2);
    expect(outcome.room.players[1].symbol).toBe(SYMBOL.O);
    expect(outcome.room.players[1].name).toBe('Guest');
    expect(outcome.room.game).not.toBeNull();
    expect(service.listOpenRooms()).toHaveLength(0);
  });

  it('rejects joining an unknown room', () => {
    const service = new RoomService();
    const outcome = service.joinRoom('missing', 'socket-2', 'Guest');
    expect(outcome).toEqual({ ok: false, error: ROOM_ERROR.NOT_FOUND });
  });

  it('rejects joining a full room', () => {
    const service = new RoomService();
    const room = service.createRoom('room', 'socket-1', 'Host');
    service.joinRoom(room.id, 'socket-2', 'Guest');

    const outcome = service.joinRoom(room.id, 'socket-3', 'Latecomer');
    expect(outcome).toEqual({ ok: false, error: ROOM_ERROR.FULL });
  });

  it('rejects joining a room the socket is already in', () => {
    const service = new RoomService();
    const room = service.createRoom('room', 'socket-1', 'Host');
    const outcome = service.joinRoom(room.id, 'socket-1', 'Host');
    expect(outcome).toEqual({ ok: false, error: ROOM_ERROR.ALREADY_IN_ROOM });
  });
});

describe('RoomService.applyMoveBySocket / getRoomBySocket', () => {
  it('applies a valid move from the X player and updates the board', () => {
    const service = new RoomService();
    const room = service.createRoom('room', 'host', 'Host');
    service.joinRoom(room.id, 'guest', 'Guest');

    const result = service.applyMoveBySocket('host', 0);
    if (result === undefined || !result.outcome.ok) {
      throw new Error('expected a successful move');
    }
    expect(result.outcome.state.board[0]).toBe(SYMBOL.X);
    expect(result.room.game?.board[0]).toBe(SYMBOL.X);
  });

  it('rejects a move made out of turn', () => {
    const service = new RoomService();
    const room = service.createRoom('room', 'host', 'Host');
    service.joinRoom(room.id, 'guest', 'Guest');
    service.applyMoveBySocket('host', 0); // X moves, now O's turn

    const result = service.applyMoveBySocket('host', 1); // X again
    if (result === undefined || result.outcome.ok) {
      throw new Error('expected the move to be rejected');
    }
    expect(result.outcome.error).toBe(MOVE_ERROR.NOT_YOUR_TURN);
  });

  it('returns undefined for a socket not in any room', () => {
    const service = new RoomService();
    expect(service.applyMoveBySocket('nobody', 0)).toBeUndefined();
    expect(service.getRoomBySocket('nobody')).toBeUndefined();
  });
});

describe('RoomService.handleDisconnect / removeRoom', () => {
  it('removes the room and returns the remaining player on disconnect', () => {
    const service = new RoomService();
    const room = service.createRoom('room', 'host', 'Host');
    service.joinRoom(room.id, 'guest', 'Guest');

    const result = service.handleDisconnect('host');
    if (result === undefined) {
      throw new Error('expected a disconnect result');
    }
    expect(result.room.id).toBe(room.id);
    expect(result.remaining?.socketId).toBe('guest');
    expect(service.getRoomBySocket('guest')).toBeUndefined();
  });

  it('returns undefined when the socket is in no room', () => {
    const service = new RoomService();
    expect(service.handleDisconnect('nobody')).toBeUndefined();
  });

  it('removeRoom deletes a room from the registry', () => {
    const service = new RoomService();
    const room = service.createRoom('room', 'host', 'Host');
    service.removeRoom(room.id);
    expect(service.listOpenRooms()).toHaveLength(0);
  });

  // Cover solo-host disconnect so remaining is undefined, not another player
  it('returns undefined remaining when the host disconnects from a solo room', () => {
    const service = new RoomService();
    service.createRoom('room', 'host', 'Host');
    const result = service.handleDisconnect('host');
    if (result === undefined) {
      throw new Error('expected a disconnect result');
    }
    expect(result.remaining).toBeUndefined();
    expect(service.getRoomBySocket('host')).toBeUndefined();
  });
});

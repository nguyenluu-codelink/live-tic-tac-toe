import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/env';
import { SCREEN, useSocketStore } from '@/stores/socketStore';
import { useGameStore } from '@/stores/gameStore';
import { MEDIA_STATUS, useMediaStore } from '@/stores/mediaStore';
import {
  EVENT,
  type ErrorPayload,
  type GameStatePayload,
  type RoomJoinedPayload,
  type RoomSummary,
  type RtcStartPayload,
} from '@/types/events';
import {
  closePeer,
  handleRemoteAnswer,
  handleRemoteIce,
  handleRemoteOffer,
  startLocalPreview,
  startPeer,
} from './webrtc';

/** Request the current open-room list, for populating the lobby */
export const requestLobby = (): void => {
  useSocketStore.getState().socket?.emit(EVENT.LOBBY_LIST);
};

/** Tear down the WebRTC peer and reset room/game/media state, for returning cleanly to the lobby */
const leaveToLobby = (): void => {
  closePeer();
  useMediaStore.getState().reset();
  useGameStore.getState().reset();
  useSocketStore.getState().resetRoom();
  useSocketStore.getState().setScreen(SCREEN.LOBBY);
  // Refresh the lobby list since we left the room context
  requestLobby();
};

/** Connect to the signaling server and wire every server event into the stores, for the whole app lifecycle */
export const connectSocket = (playerName: string): void => {
  const store = useSocketStore.getState();
  // Reuse an existing socket if already connected, to avoid duplicate connections
  if (store.socket) {
    return;
  }

  const socket = io(SOCKET_URL, { transports: ['websocket'] });
  store.setSocket(socket);
  store.setPlayerName(playerName);

  socket.on('connect', () => {
    useSocketStore.getState().setConnected(true);
    // Move to the lobby once connected, so the user leaves the name-entry screen
    useSocketStore.getState().setScreen(SCREEN.LOBBY);
    // Ask for the current lobby list as soon as we are connected
    requestLobby();
  });

  socket.on('disconnect', () => useSocketStore.getState().setConnected(false));

  // Lobby list: replace the whole list with the server's snapshot
  socket.on(EVENT.LOBBY_LIST, (rooms: RoomSummary[]) => useSocketStore.getState().setRooms(rooms));

  // A new room appeared: add it for any client viewing the lobby
  socket.on(EVENT.ROOM_CREATED, (room: RoomSummary) => useSocketStore.getState().addRoom(room));

  // A room is no longer joinable: drop it from the list
  socket.on(EVENT.ROOM_REMOVED, ({ id }: { id: string }) => useSocketStore.getState().removeRoom(id));

  // We joined (or created) a room: store our symbol, switch screens, and start the self-preview
  socket.on(EVENT.ROOM_JOINED, ({ roomId, symbol }: RoomJoinedPayload) => {
    useSocketStore.getState().enterRoom(roomId, symbol);
    // Request the camera now so the player sees themselves before the opponent joins
    void startLocalPreview();
  });

  // Pairing starts: record the opponent name and begin the WebRTC handshake
  socket.on(EVENT.RTC_START, ({ initiator, opponentName }: RtcStartPayload) => {
    useSocketStore.getState().setOpponentName(opponentName);
    useMediaStore.getState().setStatus(MEDIA_STATUS.CONNECTING);
    void startPeer(initiator);
  });

  // Relay handlers feed remote signaling into the peer connection
  socket.on(EVENT.RTC_OFFER, (offer: RTCSessionDescriptionInit) => void handleRemoteOffer(offer));
  socket.on(EVENT.RTC_ANSWER, (answer: RTCSessionDescriptionInit) => void handleRemoteAnswer(answer));
  socket.on(EVENT.RTC_ICE, (candidate: RTCIceCandidateInit) => void handleRemoteIce(candidate));

  // Authoritative game state: just store it; components derive turn/render from it
  socket.on(EVENT.GAME_STATE, (state: GameStatePayload) => useGameStore.getState().setState(state));

  // Game over: the GAME_STATE already carries the terminal result, so the overlay reacts to that.
  // The 10s countdown + navigation is driven by ROOM_CLOSED below.
  socket.on(EVENT.GAME_OVER, () => {
    /* no-op: terminal result arrives via GAME_STATE; overlay reads it */
  });

  // Room closed (after the result window, or immediately for the forfeit survivor): go back to lobby idempotently
  socket.on(EVENT.ROOM_CLOSED, () => {
    if (useSocketStore.getState().roomId !== null) {
      leaveToLobby();
    }
  });

  // Typed error: surface it as a toast via a CustomEvent the UI listens for
  socket.on(EVENT.ERROR, ({ code }: ErrorPayload) =>
    window.dispatchEvent(new CustomEvent('app-error', { detail: code })),
  );
};

/** Create a named room as host, for starting a new match */
export const createRoom = (name: string): void => {
  const { socket, playerName } = useSocketStore.getState();
  socket?.emit(EVENT.ROOM_CREATE, { name, playerName });
};

/** Join an existing room as the second player, for pairing */
export const joinRoom = (roomId: string): void => {
  const { socket, playerName } = useSocketStore.getState();
  socket?.emit(EVENT.ROOM_JOIN, { roomId, playerName });
};

/** Send a tapped cell to the server, which validates and broadcasts the new state */
export const sendMove = (cell: number): void => {
  useSocketStore.getState().socket?.emit(EVENT.GAME_MOVE, { cell });
};

/** Leave the current room and return to the lobby, for an explicit forfeit (no room:closed comes back to us) */
export const leaveRoom = (): void => {
  useSocketStore.getState().socket?.emit(EVENT.ROOM_LEAVE);
  leaveToLobby();
};

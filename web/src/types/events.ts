/** Socket.IO event names, mirroring the server's EVENT map so the contract stays in sync */
export const EVENT = {
  LOBBY_LIST: 'lobby:list',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_CREATED: 'room:created',
  ROOM_REMOVED: 'room:removed',
  ROOM_JOINED: 'room:joined',
  ROOM_CLOSED: 'room:closed',
  GAME_MOVE: 'game:move',
  GAME_STATE: 'game:state',
  GAME_OVER: 'game:over',
  RTC_START: 'rtc:start',
  RTC_OFFER: 'rtc:offer',
  RTC_ANSWER: 'rtc:answer',
  RTC_ICE: 'rtc:ice',
  ERROR: 'error',
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

/** Player symbols, matching the server SYMBOL map */
export const SYMBOL = { X: 'X', O: 'O' } as const;

export type PlayerSymbol = (typeof SYMBOL)[keyof typeof SYMBOL];

/** Game outcomes, matching the server RESULT map for rendering end states */
export const RESULT = {
  IN_PROGRESS: 'IN_PROGRESS',
  X_WINS: 'X_WINS',
  O_WINS: 'O_WINS',
  DRAW: 'DRAW',
  OPPONENT_LEFT: 'OPPONENT_LEFT',
} as const;

export type GameResult = (typeof RESULT)[keyof typeof RESULT];

/** A single rendered cell, an X/O symbol or empty */
export type Cell = PlayerSymbol | null;

/** Authoritative board snapshot from the server, the only thing the client renders */
export type GameStatePayload = {
  board: Cell[];
  turn: PlayerSymbol;
  result: GameResult;
};

/** A lobby room summary, matching the server RoomSummary for the room list */
export type RoomSummary = {
  id: string;
  name: string;
  hostName: string;
};

/** room:joined payload, telling this client its room id and assigned symbol */
export type RoomJoinedPayload = { roomId: string; symbol: PlayerSymbol };

/** rtc:start payload, telling the client whether to offer and who the opponent is */
export type RtcStartPayload = { initiator: boolean; opponentName: string };

/** game:over payload, the trigger for the result overlay */
export type GameOverPayload = { result: GameResult };

/** error payload, carrying a typed error code for toasts */
export type ErrorPayload = { code: string };

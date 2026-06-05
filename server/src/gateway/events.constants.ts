/** Socket.IO event names, the single source of truth for the client/server contract */
export const EVENT = {
  // Lobby + rooms
  LOBBY_LIST: 'lobby:list',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_CREATED: 'room:created',
  ROOM_REMOVED: 'room:removed',
  ROOM_JOINED: 'room:joined',
  ROOM_CLOSED: 'room:closed',
  // Game
  GAME_MOVE: 'game:move',
  GAME_STATE: 'game:state',
  GAME_OVER: 'game:over',
  // WebRTC signaling
  RTC_START: 'rtc:start',
  RTC_OFFER: 'rtc:offer',
  RTC_ANSWER: 'rtc:answer',
  RTC_ICE: 'rtc:ice',
  // Errors
  ERROR: 'error',
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

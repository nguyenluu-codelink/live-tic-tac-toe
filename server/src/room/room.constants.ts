/** Room join failure reasons, for typed error responses */
export const ROOM_ERROR = {
  NOT_FOUND: 'ROOM_NOT_FOUND',
  FULL: 'ROOM_FULL',
  ALREADY_IN_ROOM: 'ALREADY_IN_ROOM',
  NAME_REQUIRED: 'NAME_REQUIRED',
} as const;

export type RoomError = (typeof ROOM_ERROR)[keyof typeof ROOM_ERROR];

/** Maximum players per room, to keep the game 1v1 */
export const MAX_PLAYERS = 2;

/** Delay before a finished room is destroyed, matching the 10s client result window */
export const GAME_END_CLEANUP_MS = 10_000;

/** Every message exchanged between a browser and the room server. */

export const ROOM_CODE_LENGTH = 4;
/** No 0/O or 1/I, so a code read off a screen cannot be mistyped. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ClientMessage =
  | { type: "create-room" }
  | { type: "join-room"; code: string };

export type ErrorReason = "room-not-found" | "room-full" | "bad-message";

export type ServerMessage =
  | { type: "room-created"; code: string }
  | { type: "room-joined"; code: string }
  | { type: "peer-joined" }
  | { type: "peer-left" }
  | { type: "error"; reason: ErrorReason };

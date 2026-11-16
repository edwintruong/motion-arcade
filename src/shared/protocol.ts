/**
 * Every message exchanged between a browser and the room server.
 * The server only pairs devices and relays `data`; it knows nothing
 * about any particular game.
 */

export const ROOM_CODE_LENGTH = 4;
/** No 0/O or 1/I, so a code read off a screen cannot be mistyped. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Phones per room. */
export const MAX_CONTROLLERS = 1;

export type ClientMessage =
  | { type: "create-room" }
  /** `slot` asks for the seat this phone held before a reconnect. */
  | { type: "join-room"; code: string; slot?: number }
  | { type: "to-host"; data: unknown }
  /** Without `slot`, goes to every phone in the room. */
  | { type: "to-controller"; slot?: number; data: unknown };

export type ErrorReason = "room-not-found" | "room-full" | "bad-message";

export type ServerMessage =
  | { type: "room-created"; code: string }
  | { type: "room-joined"; code: string; slot: number }
  | { type: "peer-joined"; slot: number }
  | { type: "peer-left"; slot: number }
  | { type: "from-controller"; slot: number; data: unknown }
  | { type: "from-host"; data: unknown }
  | { type: "error"; reason: ErrorReason };

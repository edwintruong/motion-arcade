import type { Server } from "node:http";
import { randomInt } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import {
  MAX_CONTROLLERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ClientMessage,
  type ServerMessage,
} from "../shared/protocol";

/** One computer (the host, showing the game) and its phones, one per seat. */
interface Room {
  code: string;
  host: WebSocket;
  controllers: (WebSocket | undefined)[];
  /** The other computer in an online match, if any. */
  opponent?: Room;
}

type Seat = { room: Room; slot: number | "host" };

function send(ws: WebSocket | undefined, msg: ServerMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function parse(raw: string): ClientMessage | null {
  try {
    const m = JSON.parse(raw);
    const slot = m?.slot;
    const slotOk =
      slot === undefined ||
      (Number.isInteger(slot) && slot >= 0 && slot < MAX_CONTROLLERS);
    switch (m?.type) {
      case "create-room":
        return { type: "create-room" };
      case "join-room":
        if (typeof m.code === "string" && slotOk)
          return { type: "join-room", code: m.code, slot };
        break;
      case "to-host":
        if ("data" in m) return { type: "to-host", data: m.data };
        break;
      case "to-controller":
        if ("data" in m && slotOk)
          return { type: "to-controller", slot, data: m.data };
        break;
      case "join-match":
        if (typeof m.code === "string") return { type: "join-match", code: m.code };
        break;
      case "leave-match":
        return { type: "leave-match" };
      case "to-opponent":
        if ("data" in m) return { type: "to-opponent", data: m.data };
        break;
    }
  } catch {}
  return null;
}

/** Serves rooms over WebSocket at `path` on an existing HTTP server. */
export function attachRooms(http: Server, path = "/ws", heartbeatMs = 15_000) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const rooms = new Map<string, Room>();
  /** Where each connection currently sits. */
  const seats = new Map<WebSocket, Seat>();

  // Only claim our own path, so other upgrade listeners (Vite HMR) still work.
  http.on("upgrade", (req, socket, head) => {
    if (new URL(req.url ?? "", "http://x").pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });

  function newCode(): string {
    for (;;) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i++)
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!rooms.has(code)) return code;
    }
  }

  /** A room lives exactly as long as its host; phones can come and go. */
  function leave(ws: WebSocket) {
    const seat = seats.get(ws);
    if (!seat) return;
    seats.delete(ws);
    const { room, slot } = seat;
    if (slot === "host") {
      unlink(room);
      rooms.delete(room.code);
      room.controllers.forEach((c, i) => {
        if (!c) return;
        seats.delete(c);
        send(c, { type: "peer-left", slot: i });
      });
    } else {
      room.controllers[slot] = undefined;
      send(room.host, { type: "peer-left", slot });
    }
  }

  function unlink(room: Room) {
    const opponent = room.opponent;
    if (!opponent) return;
    room.opponent = opponent.opponent = undefined;
    send(opponent.host, { type: "opponent-left" });
  }

  function join(ws: WebSocket, rawCode: string, wanted?: number) {
    leave(ws);
    const code = rawCode.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return send(ws, { type: "error", reason: "room-not-found" });
    const free = (i: number) => i < MAX_CONTROLLERS && !room.controllers[i];
    let slot = wanted !== undefined && free(wanted) ? wanted : 0;
    while (slot < MAX_CONTROLLERS && !free(slot)) slot++;
    if (slot >= MAX_CONTROLLERS)
      return send(ws, { type: "error", reason: "room-full" });
    room.controllers[slot] = ws;
    seats.set(ws, { room, slot });
    send(ws, { type: "room-joined", code, slot });
    send(room.host, { type: "peer-joined", slot });
  }

  function handle(ws: WebSocket, msg: ClientMessage) {
    const seat = seats.get(ws);
    switch (msg.type) {
      case "create-room": {
        leave(ws);
        const room: Room = { code: newCode(), host: ws, controllers: [] };
        rooms.set(room.code, room);
        seats.set(ws, { room, slot: "host" });
        return send(ws, { type: "room-created", code: room.code });
      }
      case "join-room":
        return join(ws, msg.code, msg.slot);
      case "to-host":
        if (!seat || seat.slot === "host") break;
        return send(seat.room.host, {
          type: "from-controller",
          slot: seat.slot,
          data: msg.data,
        });
      case "to-controller": {
        if (seat?.slot !== "host") break;
        const targets =
          msg.slot === undefined
            ? seat.room.controllers
            : [seat.room.controllers[msg.slot]];
        for (const c of targets) send(c, { type: "from-host", data: msg.data });
        return;
      }
      case "join-match": {
        if (seat?.slot !== "host") break;
        const mine = seat.room;
        const theirs = rooms.get(msg.code.trim().toUpperCase());
        if (!theirs || theirs === mine)
          return send(ws, { type: "error", reason: "match-not-found" });
        if (theirs.opponent) return send(ws, { type: "error", reason: "match-full" });
        unlink(mine);
        mine.opponent = theirs;
        theirs.opponent = mine;
        send(ws, { type: "match-joined", code: theirs.code });
        return send(theirs.host, { type: "opponent-joined" });
      }
      case "leave-match":
        if (seat?.slot !== "host") break;
        return unlink(seat.room);
      case "to-opponent":
        if (seat?.slot !== "host" || !seat.room.opponent) break;
        return send(seat.room.opponent.host, { type: "from-opponent", data: msg.data });
    }
    send(ws, { type: "error", reason: "bad-message" });
  }

  // A phone that drops off wifi never says goodbye; pings find it.
  const alive = new WeakSet<WebSocket>();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) ws.terminate();
      alive.delete(ws);
      ws.ping();
    }
  }, heartbeatMs);
  http.on("close", () => clearInterval(heartbeat));

  wss.on("connection", (ws: WebSocket) => {
    alive.add(ws);
    ws.on("pong", () => alive.add(ws));
    ws.on("close", () => leave(ws));
    ws.on("error", () => ws.terminate());
    ws.on("message", (raw) => {
      const msg = parse(String(raw));
      if (msg) handle(ws, msg);
      else send(ws, { type: "error", reason: "bad-message" });
    });
  });
}

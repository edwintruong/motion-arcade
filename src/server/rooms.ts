import type { Server } from "node:http";
import { randomInt } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ClientMessage,
  type ServerMessage,
} from "../shared/protocol";

/** One computer (the host, showing the game) and at most one phone (the controller). */
interface Room {
  host: WebSocket;
  controller?: WebSocket;
}

function send(ws: WebSocket | undefined, msg: ServerMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function parse(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (msg?.type === "create-room") return { type: "create-room" };
    if (msg?.type === "join-room" && typeof msg.code === "string")
      return { type: "join-room", code: msg.code };
  } catch {}
  return null;
}

/** Serves rooms over WebSocket at `path` on an existing HTTP server. */
export function attachRooms(http: Server, path = "/ws", heartbeatMs = 15_000) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const rooms = new Map<string, Room>();
  /** Which room each connection is currently in. */
  const membership = new Map<WebSocket, string>();

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

  /** A room lives exactly as long as its host; a controller can come and go. */
  function leave(ws: WebSocket) {
    const code = membership.get(ws);
    const room = code && rooms.get(code);
    if (!code || !room) return;
    membership.delete(ws);
    if (room.host === ws) {
      rooms.delete(code);
      if (room.controller) membership.delete(room.controller);
      send(room.controller, { type: "peer-left" });
    } else {
      room.controller = undefined;
      send(room.host, { type: "peer-left" });
    }
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
      if (!msg) return send(ws, { type: "error", reason: "bad-message" });

      if (msg.type === "create-room") {
        leave(ws);
        const code = newCode();
        rooms.set(code, { host: ws });
        membership.set(ws, code);
        send(ws, { type: "room-created", code });
      } else {
        leave(ws);
        const code = msg.code.trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) return send(ws, { type: "error", reason: "room-not-found" });
        if (room.controller)
          return send(ws, { type: "error", reason: "room-full" });
        room.controller = ws;
        membership.set(ws, code);
        send(ws, { type: "room-joined", code });
        send(room.host, { type: "peer-joined" });
      }
    });
  });
}

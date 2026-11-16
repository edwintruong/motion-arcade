import type { ClientMessage, ServerMessage } from "../shared/protocol";

/**
 * The only thing the rest of the client knows about the network.
 * Today it is a WebSocket to the room server; another transport can
 * replace it without the views changing.
 */
export interface Connection {
  send(msg: ClientMessage): void;
}

export interface ConnectionHandlers {
  onOpen(conn: Connection): void;
  onMessage(msg: ServerMessage): void;
  onClose(): void;
}

export function connect(handlers: ConnectionHandlers): void {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${scheme}://${location.host}/ws`);
  const conn: Connection = { send: (msg) => ws.send(JSON.stringify(msg)) };
  ws.onopen = () => handlers.onOpen(conn);
  ws.onmessage = (e) => handlers.onMessage(JSON.parse(e.data));
  ws.onclose = () => handlers.onClose();
}

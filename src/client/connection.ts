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
  /** Called on the first connection and again after every reconnect. */
  onOpen(conn: Connection): void;
  onMessage(msg: ServerMessage): void;
  /** The link dropped; a reconnect is already being attempted. */
  onClose(): void;
}

export function connect(handlers: ConnectionHandlers): Connection {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  let ws: WebSocket;
  let retryMs = 500;
  const conn: Connection = {
    send(msg) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
  };
  const open = () => {
    ws = new WebSocket(`${scheme}://${location.host}/ws`);
    ws.onopen = () => {
      retryMs = 500;
      handlers.onOpen(conn);
    };
    ws.onmessage = (e) => handlers.onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      handlers.onClose();
      setTimeout(open, retryMs);
      retryMs = Math.min(retryMs * 2, 4000);
    };
  };
  open();
  return conn;
}

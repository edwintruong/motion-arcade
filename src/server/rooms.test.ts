import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, expect, test } from "vitest";
import { WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "../shared/protocol";
import { attachRooms } from "./rooms";

let http: Server;
let url: string;
const sockets: WebSocket[] = [];

beforeEach(async () => {
  http = createServer();
  attachRooms(http);
  await new Promise<void>((r) => http.listen(0, r));
  url = `ws://localhost:${(http.address() as AddressInfo).port}/ws`;
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  await new Promise((r) => http.close(r));
});

/** A browser as the server sees it: sends messages, reads replies in order. */
async function connect() {
  const ws = new WebSocket(url);
  sockets.push(ws);
  const inbox: ServerMessage[] = [];
  const waiting: ((m: ServerMessage) => void)[] = [];
  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw)) as ServerMessage;
    const w = waiting.shift();
    if (w) w(msg);
    else inbox.push(msg);
  });
  await new Promise((r) => ws.once("open", r));
  return {
    send: (m: ClientMessage | string) =>
      ws.send(typeof m === "string" ? m : JSON.stringify(m)),
    next: () =>
      new Promise<ServerMessage>((resolve, reject) => {
        const m = inbox.shift();
        if (m) return resolve(m);
        const timer = setTimeout(() => reject(new Error("no message")), 1000);
        waiting.push((msg) => (clearTimeout(timer), resolve(msg)));
      }),
    leave: () => ws.close(),
  };
}

async function pairedRoom() {
  const { host, code } = await hostWithRoom();
  const phone = await connect();
  phone.send({ type: "join-room", code });
  await phone.next();
  await host.next();
  return { host, phone, code };
}

async function hostWithRoom() {
  const host = await connect();
  host.send({ type: "create-room" });
  const created = await host.next();
  if (created.type !== "room-created") throw new Error("room not created");
  return { host, code: created.code };
}

test("a computer creates a room and gets a 4-character code with no confusable characters", async () => {
  const host = await connect();
  host.send({ type: "create-room" });
  const msg = await host.next();
  expect(msg.type).toBe("room-created");
  expect((msg as { code: string }).code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
});

test("a phone joins with the room code and both sides learn they are connected", async () => {
  const { host, code } = await hostWithRoom();
  const phone = await connect();
  phone.send({ type: "join-room", code });
  expect(await phone.next()).toEqual({ type: "room-joined", code, slot: 0 });
  expect(await host.next()).toEqual({ type: "peer-joined", slot: 0 });
});

test("a phone typing a code for a room that does not exist is told so and can try again", async () => {
  const { host, code } = await hostWithRoom();
  const phone = await connect();
  const wrong = code === "ZZZZ" ? "YYYY" : "ZZZZ";
  phone.send({ type: "join-room", code: wrong });
  expect(await phone.next()).toEqual({ type: "error", reason: "room-not-found" });
  phone.send({ type: "join-room", code });
  expect(await phone.next()).toEqual({ type: "room-joined", code, slot: 0 });
  expect(await host.next()).toEqual({ type: "peer-joined", slot: 0 });
});

test("the room code can be typed in lowercase with stray spaces", async () => {
  const { code } = await hostWithRoom();
  const phone = await connect();
  phone.send({ type: "join-room", code: ` ${code.toLowerCase()} ` });
  expect(await phone.next()).toEqual({ type: "room-joined", code, slot: 0 });
});

test("two phones share a room, each in its own seat, and the computer knows who sent what", async () => {
  const { host, code } = await hostWithRoom();
  const first = await connect();
  first.send({ type: "join-room", code });
  expect(await first.next()).toEqual({ type: "room-joined", code, slot: 0 });
  const second = await connect();
  second.send({ type: "join-room", code });
  expect(await second.next()).toEqual({ type: "room-joined", code, slot: 1 });
  expect(await host.next()).toEqual({ type: "peer-joined", slot: 0 });
  expect(await host.next()).toEqual({ type: "peer-joined", slot: 1 });

  second.send({ type: "to-host", data: "from second" });
  expect(await host.next()).toEqual({ type: "from-controller", slot: 1, data: "from second" });
  host.send({ type: "to-controller", slot: 1, data: "only second" });
  host.send({ type: "to-controller", data: "everyone" });
  expect(await second.next()).toEqual({ type: "from-host", data: "only second" });
  expect(await second.next()).toEqual({ type: "from-host", data: "everyone" });
  expect(await first.next()).toEqual({ type: "from-host", data: "everyone" });
});

test("a third phone is told the room is full", async () => {
  const { code } = await hostWithRoom();
  for (let i = 0; i < 2; i++) {
    const phone = await connect();
    phone.send({ type: "join-room", code });
    await phone.next();
  }
  const third = await connect();
  third.send({ type: "join-room", code });
  expect(await third.next()).toEqual({ type: "error", reason: "room-full" });
});

test("when one of two phones drops out, it returns to its own seat", async () => {
  const { host, code } = await hostWithRoom();
  const first = await connect();
  first.send({ type: "join-room", code });
  await first.next();
  const second = await connect();
  second.send({ type: "join-room", code });
  await second.next();
  await host.next();
  await host.next();
  second.leave();
  expect(await host.next()).toEqual({ type: "peer-left", slot: 1 });
  const back = await connect();
  back.send({ type: "join-room", code, slot: 1 });
  expect(await back.next()).toEqual({ type: "room-joined", code, slot: 1 });
});

test("a message the server cannot understand gets an error instead of crashing it", async () => {
  const client = await connect();
  client.send("not json");
  expect(await client.next()).toEqual({ type: "error", reason: "bad-message" });
  client.send(JSON.stringify({ type: "join-room" }));
  expect(await client.next()).toEqual({ type: "error", reason: "bad-message" });
  client.send({ type: "create-room" });
  expect((await client.next()).type).toBe("room-created");
});

test("when the phone leaves, the computer is told and another phone can take its place", async () => {
  const { host, code } = await hostWithRoom();
  const phone = await connect();
  phone.send({ type: "join-room", code });
  await phone.next();
  await host.next();
  phone.leave();
  expect(await host.next()).toEqual({ type: "peer-left", slot: 0 });

  const replacement = await connect();
  replacement.send({ type: "join-room", code });
  expect(await replacement.next()).toEqual({ type: "room-joined", code, slot: 0 });
});

test("when the computer leaves, the phone is told and the room no longer exists", async () => {
  const { host, code } = await hostWithRoom();
  const phone = await connect();
  phone.send({ type: "join-room", code });
  await phone.next();
  host.leave();
  expect(await phone.next()).toEqual({ type: "peer-left", slot: 0 });

  const late = await connect();
  late.send({ type: "join-room", code });
  expect(await late.next()).toEqual({ type: "error", reason: "room-not-found" });
});

test("what the phone sends reaches the computer, and what the computer sends reaches the phone", async () => {
  const { host, phone } = await pairedRoom();
  phone.send({ type: "to-host", data: { k: "swing", power: 0.5 } });
  expect(await host.next()).toEqual({
    type: "from-controller",
    slot: 0,
    data: { k: "swing", power: 0.5 },
  });
  host.send({ type: "to-controller", data: { k: "hit" } });
  expect(await phone.next()).toEqual({ type: "from-host", data: { k: "hit" } });
});

test("a phone that drops out gets its seat back when it rejoins with the same code", async () => {
  const { host, phone, code } = await pairedRoom();
  phone.leave();
  expect(await host.next()).toEqual({ type: "peer-left", slot: 0 });
  const again = await connect();
  again.send({ type: "join-room", code, slot: 0 });
  expect(await again.next()).toEqual({ type: "room-joined", code, slot: 0 });
  expect(await host.next()).toEqual({ type: "peer-joined", slot: 0 });
  again.send({ type: "to-host", data: 1 });
  expect(await host.next()).toEqual({ type: "from-controller", slot: 0, data: 1 });
});

test("a device that is not in a room cannot relay anything", async () => {
  const stray = await connect();
  stray.send({ type: "to-host", data: 1 });
  expect(await stray.next()).toEqual({ type: "error", reason: "bad-message" });
});

// ---- online: two computers, each with its own room, play each other --------

async function linkedHosts() {
  const a = await hostWithRoom();
  const b = await hostWithRoom();
  b.host.send({ type: "join-match", code: a.code });
  expect(await b.host.next()).toEqual({ type: "match-joined", code: a.code });
  expect(await a.host.next()).toEqual({ type: "opponent-joined" });
  return { a, b };
}

test("a computer joins another computer's match with its room code, and they can talk", async () => {
  const { a, b } = await linkedHosts();
  a.host.send({ type: "to-opponent", data: { k: "hit" } });
  expect(await b.host.next()).toEqual({ type: "from-opponent", data: { k: "hit" } });
  b.host.send({ type: "to-opponent", data: 2 });
  expect(await a.host.next()).toEqual({ type: "from-opponent", data: 2 });
});

test("each computer keeps its own phone while playing online", async () => {
  const { a, b } = await linkedHosts();
  const phone = await connect();
  phone.send({ type: "join-room", code: b.code });
  expect(await phone.next()).toEqual({ type: "room-joined", code: b.code, slot: 0 });
  expect(await b.host.next()).toEqual({ type: "peer-joined", slot: 0 });
  phone.send({ type: "to-host", data: "swing" });
  expect(await b.host.next()).toEqual({ type: "from-controller", slot: 0, data: "swing" });
  a.host.send({ type: "to-opponent", data: "still linked" });
  expect(await b.host.next()).toEqual({ type: "from-opponent", data: "still linked" });
});

test("a match code that does not exist, or is one's own, is refused", async () => {
  const { host, code } = await hostWithRoom();
  host.send({ type: "join-match", code: code === "ZZZZ" ? "YYYY" : "ZZZZ" });
  expect(await host.next()).toEqual({ type: "error", reason: "match-not-found" });
  host.send({ type: "join-match", code });
  expect(await host.next()).toEqual({ type: "error", reason: "match-not-found" });
});

test("a match already has its two computers: a third is refused", async () => {
  const { a } = await linkedHosts();
  const c = await hostWithRoom();
  c.host.send({ type: "join-match", code: a.code });
  expect(await c.host.next()).toEqual({ type: "error", reason: "match-full" });
});

test("when one computer leaves the match or disconnects, the other is told", async () => {
  const first = await linkedHosts();
  first.b.host.send({ type: "leave-match" });
  expect(await first.a.host.next()).toEqual({ type: "opponent-left" });
  // Having left, it is free to be joined again.
  first.b.host.send({ type: "join-match", code: first.a.code });
  expect(await first.b.host.next()).toEqual({ type: "match-joined", code: first.a.code });
  expect(await first.a.host.next()).toEqual({ type: "opponent-joined" });

  first.a.host.leave();
  expect(await first.b.host.next()).toEqual({ type: "opponent-left" });
});

test("talking to an opponent that is not there is an error", async () => {
  const { host } = await hostWithRoom();
  host.send({ type: "to-opponent", data: 1 });
  expect(await host.next()).toEqual({ type: "error", reason: "bad-message" });
});

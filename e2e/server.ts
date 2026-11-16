import { spawn } from "node:child_process";

export const PORT = 3210;
export const BASE = `http://localhost:${PORT}`;

/** Starts the real dev server for the browser tests and stops it afterwards. */
export default async function setup() {
  const server = spawn("npx", ["tsx", "src/server/main.ts"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return () => {
    process.kill(-server.pid!);
  };
}

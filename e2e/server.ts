import { execSync, spawn } from "node:child_process";

export const PORT = 3210;
export const BASE = `http://localhost:${PORT}`;
/** The built app, as it runs once deployed or installed. */
export const PROD_BASE = `http://localhost:${PORT + 1}`;

/** Starts the real dev server for the browser tests and stops it afterwards. */
export default async function setup() {
  const server = spawn("npx", ["tsx", "src/server/main.ts"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
    detached: true,
  });
  // The test runner sets NODE_ENV=test, which would build a non-production bundle.
  execSync("npx vite build", { stdio: "ignore", env: { ...process.env, NODE_ENV: "production" } });
  const built = spawn("npx", ["tsx", "src/server/main.ts"], {
    env: { ...process.env, PORT: String(PORT + 1), NODE_ENV: "production" },
    stdio: "ignore",
    detached: true,
  });
  for (const base of [BASE, PROD_BASE]) {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return () => {
    process.kill(-server.pid!);
    process.kill(-built.pid!);
  };
}

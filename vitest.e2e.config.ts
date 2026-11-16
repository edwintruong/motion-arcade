import { defineConfig } from "vitest/config";

// Browser tests: a real server, a real Chromium, simulated phone sensors.
export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
    globalSetup: "e2e/server.ts",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});

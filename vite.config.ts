import { defineConfig } from "vite";

export default defineConfig({
  root: "src/client",
  build: { outDir: "../../dist/client", emptyOutDir: true },
  // Phones reach the dev server through an HTTPS tunnel (see README).
  server: { allowedHosts: [".trycloudflare.com", ".ngrok-free.app"] },
});

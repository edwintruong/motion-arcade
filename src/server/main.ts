import { createServer, type RequestListener } from "node:http";
import { attachRooms } from "./rooms";

const port = Number(process.env.PORT ?? 3000);
const production = process.env.NODE_ENV === "production";

/** One process serves both the web pages and the room WebSocket. */
const http = createServer((req, res) => {
  // For the hosting platform's health checks.
  if (req.url === "/healthz") return void res.writeHead(200).end("ok");
  pages(req, res);
});
attachRooms(http);

let pages: RequestListener;
if (production) {
  const { default: sirv } = await import("sirv");
  const serve = sirv("dist/client", { single: true });
  pages = (req, res) =>
    serve(req, res, () => void res.writeHead(404).end());
} else {
  const { createServer: createVite } = await import("vite");
  const vite = await createVite({
    server: { middlewareMode: true, hmr: { server: http } },
  });
  pages = vite.middlewares;
}

http.listen(port, () => console.log(`Motion Arcade: http://localhost:${port}`));

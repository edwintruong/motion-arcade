import { createServer, type RequestListener, type Server } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { lanAddresses, lanCertificate } from "./lan";
import { attachRooms } from "./rooms";

const port = Number(process.env.PORT ?? 3000);
const production = process.env.NODE_ENV === "production";

/** One process serves both the web pages and the room WebSocket. */
/** LAN=1: serve HTTPS with a self-signed certificate so phones on the same network can play. */
const lan = process.env.LAN === "1";

const handler: RequestListener = (req, res) => {
  // For the hosting platform's health checks.
  if (req.url === "/healthz") return void res.writeHead(200).end("ok");
  pages(req, res);
};
const http: Server = lan
  ? (createSecureServer(lanCertificate(), handler) as unknown as Server)
  : createServer(handler);
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
    server: { middlewareMode: true, ws: { server: http }, ...(lan ? { allowedHosts: true } : {}) },
  });
  pages = vite.middlewares;
}

http.listen(port, "0.0.0.0", () => {
  if (!lan) return console.log(`Motion Arcade: http://localhost:${port}`);
  console.log("Motion Arcade, mở trên các thiết bị cùng mạng:");
  for (const ip of lanAddresses()) console.log(`  https://${ip}:${port}`);
  console.log("Lần đầu trình duyệt sẽ cảnh báo chứng chỉ tự ký: chọn Nâng cao → Tiếp tục.");
});

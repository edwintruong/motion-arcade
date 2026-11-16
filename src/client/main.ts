import { showController } from "./controller/controller";
import { showHost } from "./host/host";

/** Same URL on both devices: a touch-first device is the controller. */
function role(): "host" | "controller" {
  const asked = new URLSearchParams(location.search).get("role");
  if (asked === "host" || asked === "controller") return asked;
  return matchMedia("(pointer: coarse)").matches ? "controller" : "host";
}

const app = document.querySelector<HTMLElement>("#app")!;
if (role() === "controller") showController(app);
else showHost(app);

// Installable app: only the built version registers the offline cache.
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js");

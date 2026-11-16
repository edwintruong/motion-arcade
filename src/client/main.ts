import { showController } from "./controller";
import { showHost } from "./host";

/** Same URL on both devices: a touch-first device is the controller. */
function role(): "host" | "controller" {
  const asked = new URLSearchParams(location.search).get("role");
  if (asked === "host" || asked === "controller") return asked;
  return matchMedia("(pointer: coarse)").matches ? "controller" : "host";
}

const app = document.querySelector<HTMLElement>("#app")!;
if (role() === "controller") showController(app);
else showHost(app);

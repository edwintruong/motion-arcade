import { chromium, type Browser, type Page } from "playwright";
import { BASE } from "./server";

let browser: Browser | undefined;

export async function launch() {
  browser ??= await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  return browser;
}

export async function closeBrowser() {
  await browser?.close();
  browser = undefined;
}

/** A computer showing the game. Resolves once it has a room code. */
export async function openHost(query = "") {
  const context = await (await launch()).newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?role=host${query}`);
  await page.waitForFunction(() => /^[A-Z2-9]{4}$/.test(document.querySelector(".code")?.textContent ?? ""));
  const code = (await page.textContent(".code"))!;
  return { page, code, errors, context };
}

/** A phone: joins the room and turns on its (simulated) motion sensors. */
export async function openPhone(code: string, options: { sensors?: boolean } = {}) {
  const context = await (await launch()).newContext({
    viewport: { width: 390, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/?role=controller`);
  await page.fill("input", code);
  await page.click("form button");
  await page.waitForSelector("[data-act=enable]:visible");
  if (options.sensors ?? true) {
    await context.grantPermissions(["accelerometer", "gyroscope", "magnetometer"]);
    await page.click("[data-act=enable]");
    // A real phone starts streaming orientation as soon as it is allowed to.
    await point(page, 0, 0, 0);
    await page.waitForSelector("[data-act=calibrate]:visible");
  }
  return { page, context };
}

/** Holds the phone at the given device-orientation angles. */
export async function point(page: Page, alpha: number, beta: number, gamma: number, ms = 300) {
  await page.evaluate(
    async ([alpha, beta, gamma, ms]) => {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha, beta, gamma }));
        await new Promise((r) => setTimeout(r, 16));
      }
    },
    [alpha, beta, gamma, ms],
  );
}

export type Axis = "left" | "right" | "up" | "down";

/**
 * Swings the phone: a bell curve of gyroscope readings, like a real
 * swing, with the phone held flat and pointing at the screen.
 * "left" moves the tip right-to-left (a right-hander's forehand).
 */
export async function swing(page: Page, direction: Axis = "left", peak = 900) {
  // Device axes with the phone flat: z is up, x is to the right.
  const axis = { left: [0, 0, 1], right: [0, 0, -1], up: [1, 0, 0], down: [-1, 0, 0] }[direction];
  await page.evaluate(
    async ([axis, peak]) => {
      const [x, y, z] = axis as number[];
      for (let t = 0; t <= 300; t += 16) {
        const u = (t - 150) / 50;
        const speed = (peak as number) * Math.exp(-0.5 * u * u);
        dispatchEvent(
          new DeviceMotionEvent("devicemotion", {
            rotationRate: { beta: x * speed, gamma: y * speed, alpha: z * speed },
            interval: 16,
          }),
        );
        await new Promise((r) => setTimeout(r, 16));
      }
      // The arm comes to rest before the next swing.
      for (let i = 0; i < 20; i++) {
        dispatchEvent(new DeviceMotionEvent("devicemotion", { rotationRate: { alpha: 0, beta: 0, gamma: 0 }, interval: 16 }));
        await new Promise((r) => setTimeout(r, 16));
      }
    },
    [axis, peak] as const,
  );
}

export const SHOTS = process.env.E2E_SHOTS;
export async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

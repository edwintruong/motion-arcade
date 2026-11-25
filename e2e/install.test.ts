import { afterAll, afterEach, expect, test } from "vitest";
import { closeBrowser, closePages, newContext } from "./helpers";
import { PROD_BASE } from "./server";

afterEach(closePages);
afterAll(closeBrowser);

test("the built app declares itself installable: name, standalone window, icons", async () => {
  const manifest = await (await fetch(`${PROD_BASE}/manifest.webmanifest`)).json();
  expect(manifest).toMatchObject({ name: "Motion Arcade", display: "standalone", start_url: "/" });
  for (const size of ["192x192", "512x512"]) {
    const icon = manifest.icons.find((i: { sizes: string }) => i.sizes === size);
    const response = await fetch(PROD_BASE + icon.src);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(500);
  }
  const html = await (await fetch(PROD_BASE)).text();
  expect(html).toContain('rel="manifest"');
});

test("once opened, the app loads without a network and says pairing needs one", async () => {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${PROD_BASE}/?role=host`);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // second visit: everything passes through the cache
  await page.waitForFunction(() => /^[A-Z2-9]{4}$/.test(document.querySelector(".code")?.textContent ?? ""));

  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("h1:has-text('Pickle Garden')");
  await page.waitForSelector("canvas");
  await page.waitForSelector("text=Cần mạng để ghép điện thoại");
});

test("the installed app picks up a new version the next time it is opened", async () => {
  // Pages are fetched network-first and the worker takes over at once,
  // so nothing is pinned to an old build.
  const worker = await (await fetch(`${PROD_BASE}/sw.js`)).text();
  expect(worker).toContain("skipWaiting");
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${PROD_BASE}/?role=host`);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const requested: string[] = [];
  page.on("response", (r) => {
    if (r.request().isNavigationRequest()) requested.push(r.fromServiceWorker() ? "via-worker" : "direct");
  });
  await page.reload();
  expect(requested).toEqual(["via-worker"]);
  const fresh = await page.evaluate(async () => (await fetch("/", { cache: "no-store" })).text());
  expect(await page.content()).toContain(fresh.match(/assets\/index-[\w-]+\.js/)![0]);
});

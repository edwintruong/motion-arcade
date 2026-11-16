import { afterAll, afterEach, expect, test } from "vitest";
import { BASE } from "./server";
import { closeBrowser, closePages, newContext, openHost, openPhone, shot, swing } from "./helpers";

afterEach(closePages);
afterAll(closeBrowser);

test("the phone explains how to hold and swing it before play", async () => {
  const host = await openHost();
  const phone = await openPhone(host.code, { sensors: false });
  await phone.page.waitForSelector("text=Cầm điện thoại như cán vợt");
  await phone.page.waitForSelector("text=Căn chỉnh");
});

test("losing the phone pauses the game; it rejoins its room by itself and play resumes", async () => {
  const host = await openHost();
  const phone = await openPhone(host.code);
  await host.page.click("[data-mode=ai][data-level=easy]");
  await host.page.waitForSelector("text=Bạn giao bóng");

  await phone.page.goto("about:blank"); // the phone drops off
  await host.page.waitForSelector(".paused:visible");
  await host.page.waitForSelector(`text=nhập lại mã phòng ${host.code}`);
  await shot(host.page, "09-paused");

  await phone.page.goto(`${BASE}/?role=controller`); // it comes back: no code typed
  await phone.page.waitForSelector(`text=Đã kết nối phòng ${host.code}`);
  await host.page.waitForSelector(".paused", { state: "hidden" });
  expect(await host.page.isVisible(".scoreboard")).toBe(true);
});

test("the phone asks to keep its screen awake while playing", async () => {
  const host = await openHost();
  const context = await newContext({ hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as any).wakeLockRequests = 0;
    Object.defineProperty(navigator, "wakeLock", {
      value: { request: async () => ((window as any).wakeLockRequests++, { release: async () => {} }) },
    });
  });
  await page.goto(`${BASE}/?role=controller`);
  await page.fill("input", host.code);
  await page.click("form button");
  await page.click("[data-act=enable]");
  await page.waitForFunction(() => (window as any).wakeLockRequests > 0);
});

test("two players, one screen: each phone plays its own side of a scored match", async () => {
  const host = await openHost();
  const one = await openPhone(host.code);
  expect(await host.page.isDisabled("[data-mode=local2]")).toBe(true);
  const two = await openPhone(host.code);
  await one.page.waitForSelector("text=Bạn là Người chơi 1");
  await two.page.waitForSelector("text=Bạn là Người chơi 2");
  await host.page.click("[data-mode=local2]");
  await one.page.waitForSelector("text=Vung để giao bóng");
  await two.page.waitForSelector("text=Chuẩn bị đỡ bóng");

  // Player 2 swinging does nothing on player 1's serve...
  await swing(two.page);
  await host.page.waitForTimeout(300);
  expect(await host.page.textContent(".banner")).toContain("Người chơi 1 giao bóng");
  // ...player 1 serves, player 2 never returns it: player 1 scores.
  for (let i = 0; i < 10 && (await host.page.textContent(".banner"))!.includes("giao bóng"); i++)
    await swing(one.page);
  await host.page.waitForSelector("text=Người chơi 2 không đỡ được bóng");
  expect(await host.page.textContent("[data-points='0']")).toBe("1");
  await shot(host.page, "10-two-players");
});

test("a third phone is turned away, and a missing player pauses a two-player match", async () => {
  const host = await openHost();
  await openPhone(host.code);
  const two = await openPhone(host.code);
  const context = await newContext();
  const third = await context.newPage();
  await third.goto(`${BASE}/?role=controller`);
  await third.fill("input", host.code);
  await third.click("form button");
  await third.waitForSelector("text=Phòng này đã đủ điện thoại");

  await host.page.click("[data-mode=local2]");
  await two.page.goto("about:blank");
  await host.page.waitForSelector("text=Điện thoại của Người chơi 2 mất kết nối");
  await two.page.goto(`${BASE}/?role=controller`);
  await host.page.waitForSelector(".paused", { state: "hidden" });
});

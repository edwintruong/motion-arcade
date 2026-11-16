import { afterAll, afterEach, expect, test } from "vitest";
import type { Page } from "playwright";
import { closeBrowser, closePages, newContext, openHost, openPhone, shot, swing } from "./helpers";

afterEach(closePages);
afterAll(closeBrowser);

const practiceHits = async (host: Page) =>
  Number((await host.textContent(".scoreboard"))!.match(/Đánh trúng (\d+)/)![1]);

/** Keeps swinging, like a player flailing at every ball, until `done`. */
async function swingUntil(phone: Page, done: () => Promise<boolean>, tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await done()) return;
    await swing(phone);
  }
  throw new Error("never happened");
}

test("practice: the machine feeds balls and swinging the phone hits them back", async () => {
  const host = await openHost();
  const phone = await openPhone(host.code);
  await host.page.click("[data-mode=practice]");
  await phone.page.waitForSelector("text=Vung khi bóng tới!");
  await host.page.waitForTimeout(1800);
  await shot(host.page, "05-practice");
  await swingUntil(phone.page, async () => (await practiceHits(host.page)) >= 2);
  expect(host.errors).toEqual([]);
});

test("a match against the computer: serve by swinging, rallies are scored", async () => {
  const host = await openHost();
  const phone = await openPhone(host.code);
  await host.page.click("[data-mode=ai][data-level=easy]");
  await host.page.waitForSelector("text=Bạn giao bóng: vung để giao");
  await phone.page.waitForSelector("text=Vung để giao bóng");
  expect(await host.page.textContent(".scoreboard")).toMatch(/Bạn\s*0.*Máy \(Dễ\)\s*0/);
  // Play on until somebody has scored or the serve has changed hands.
  await swingUntil(phone.page, async () => {
    const board = await host.page.innerHTML(".scoreboard");
    return /data-points="\d">[1-9]/.test(board) || !/class="serving">Bạn/.test(board);
  });
  await shot(host.page, "07-match");
  expect(host.errors).toEqual([]);
});

test("the menu button and Escape leave the game for the lobby", async () => {
  const host = await openHost();
  await openPhone(host.code);
  await host.page.click("[data-mode=practice]");
  await host.page.click("[data-act=menu]");
  await host.page.waitForSelector(".menu:visible");
  await host.page.click("[data-mode=ai][data-level=hard]");
  await host.page.keyboard.press("Escape");
  await host.page.waitForSelector(".menu:visible");
});

test("no game can be started until a phone is connected", async () => {
  const host = await openHost();
  expect(await host.page.isDisabled("[data-mode=practice]")).toBe(true);
  await openPhone(host.code);
  await host.page.waitForSelector("[data-mode=practice]:enabled");
});

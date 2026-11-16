import { afterAll, expect, test } from "vitest";
import { closeBrowser, openHost, openPhone, point, shot, swing } from "./helpers";

afterAll(closeBrowser);

test("a phone pairs with the room code and the computer shows it connected", async () => {
  const host = await openHost();
  await host.page.waitForSelector("text=Đang chờ điện thoại");
  const phone = await openPhone(host.code, { sensors: false });
  await host.page.waitForSelector("text=Điện thoại đã kết nối");
  await phone.page.waitForSelector(`text=Đã kết nối phòng ${host.code}`);
  expect(host.errors).toEqual([]);
});

test("a wrong room code shows an error and lets the player try again", async () => {
  const host = await openHost();
  const context = await host.page.context().browser()!.newContext();
  const page = await context.newPage();
  await page.goto(host.page.url().replace("role=host", "role=controller"));
  await page.fill("input", host.code === "ZZZZ" ? "YYYY" : "ZZZZ");
  await page.click("form button");
  await page.waitForSelector("text=Không tìm thấy phòng");
  await page.fill("input", host.code.toLowerCase());
  await page.click("form button");
  await page.waitForSelector(`text=Đã kết nối phòng ${host.code}`);
});

test("the computer shows the phone's delay and data rate, and follows its orientation", async () => {
  const host = await openHost();
  const phone = await openPhone(host.code);
  await point(phone.page, 40, 30, 10, 2200);
  const stats = await host.page.textContent(".phone .stats");
  const [, latency, rate] = stats!.match(/~(\d+) ms · (\d+) mẫu/)!;
  expect(Number(latency)).toBeLessThan(100);
  expect(Number(rate)).toBeGreaterThan(15);
  await shot(host.page, "03-lobby-paddle");
  expect(host.errors).toEqual([]);
});

test("swinging the phone shows one swing with its power on the computer", async () => {
  const host = await openHost();
  const phone = await openPhone(host.code);
  await swing(phone.page, "left", 1100);
  await host.page.waitForSelector("text=/Thuận tay · lực \\d+%/");
  const hard = Number((await host.page.textContent(".phone .swing"))!.match(/(\d+)%/)![1]);
  await swing(phone.page, "right", 500);
  await host.page.waitForSelector("text=/Trái tay · lực \\d+%/");
  const gentle = Number((await host.page.textContent(".phone .swing"))!.match(/(\d+)%/)![1]);
  expect(hard).toBeGreaterThan(gentle + 30);
  await phone.page.waitForSelector("text=/Trái tay · lực/");
  await shot(host.page, "04-swing");
});

test("a device whose motion sensors cannot be used gets guidance and tap buttons instead of a blank screen", async () => {
  const host = await openHost();
  const phone = await openPhone(host.code, { sensors: false });
  await phone.page.click("[data-act=enable]");
  await phone.page.waitForSelector("text=Tạm thời dùng các nút bên dưới");
  await phone.page.click("[data-swing=lob]");
  await host.page.waitForSelector("text=/Lốp · lực 60%/");
});

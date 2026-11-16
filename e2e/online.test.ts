import { afterAll, afterEach, expect, test } from "vitest";
import { closeBrowser, closePages, newContext, openHost, openPhone, shot, swing } from "./helpers";

afterEach(closePages);
afterAll(closeBrowser);

async function twoComputers() {
  const a = await openHost();
  const b = await openHost();
  const phoneA = await openPhone(a.code);
  const phoneB = await openPhone(b.code);
  return { a, b, phoneA, phoneB };
}

test("online: one computer opens a match, the other joins with its code, and both see the same score", async () => {
  const { a, b, phoneA, phoneB } = await twoComputers();
  await a.page.click("[data-mode=online-create]");
  await a.page.waitForSelector(`text=Gửi mã phòng ${a.code}`);
  await b.page.fill(".match-code", a.code.toLowerCase());
  await b.page.click("[data-mode=online-join]");

  // Each player sees themselves as "Bạn", from their own end of the court.
  await a.page.waitForSelector("text=Bạn giao bóng: vung để giao");
  await b.page.waitForSelector("text=Đối thủ giao bóng");
  await phoneA.page.waitForSelector("text=Vung để giao bóng");
  await phoneB.page.waitForSelector("text=Chuẩn bị đỡ bóng");

  // A serves; B never swings, so the ball bounces twice on B's side: point to A.
  for (let i = 0; i < 10 && (await a.page.textContent(".banner"))!.includes("giao bóng"); i++)
    await swing(phoneA.page);
  await b.page.waitForSelector("text=Bạn không đỡ được bóng");
  await a.page.waitForSelector("text=Đối thủ không đỡ được bóng");
  expect(await a.page.textContent("[data-points='0']")).toBe("1");
  expect(await b.page.textContent("[data-points='0']")).toBe("1");
  await shot(a.page, "11-online-a");
  await shot(b.page, "11-online-b");
  expect([...a.errors, ...b.errors]).toEqual([]);

  // A goes back to the menu: B is told and returned to its own menu.
  await a.page.click("[data-act=menu]");
  await b.page.waitForSelector("text=Đối thủ đã rời trận");
  await b.page.waitForSelector(".menu:visible");
});

test("online: a wrong match code is reported", async () => {
  const b = await openHost();
  await openPhone(b.code);
  await b.page.fill(".match-code", b.code === "ZZZZ" ? "YYYY" : "ZZZZ");
  await b.page.click("[data-mode=online-join]");
  await b.page.waitForSelector("text=Không tìm thấy trận với mã này");
});

test("online: a computer that has not opened a match cannot be dragged into one", async () => {
  const { a, b } = await twoComputers();
  await b.page.fill(".match-code", a.code);
  await b.page.click("[data-mode=online-join]");
  await b.page.waitForSelector("text=Đối thủ đã rời trận hoặc chưa sẵn sàng");
  expect(await a.page.isVisible(".menu")).toBe(true);
});

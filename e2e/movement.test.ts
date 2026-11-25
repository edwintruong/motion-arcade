import { afterAll, afterEach, expect, test } from 'vitest';
import { closeBrowser, closePages, openHost, openPhone } from './helpers';

afterEach(closePages);
afterAll(closeBrowser);

test('phone steering uses sensors, stops during a stroke, and resets at neutral', async () => {
  const host = await openHost();
  const phone = await openPhone(host.code);
  await host.page.click('[data-mode=practice]');
  const pose = async (alpha: number, speed: number, duration = 500) => {
    await phone.page.evaluate(async ({alpha, speed, duration}) => {
      const end = performance.now() + duration;
      while (performance.now() < end) {
        dispatchEvent(new DeviceMotionEvent('devicemotion', {rotationRate:{alpha:speed,beta:0,gamma:0},interval:20}));
        dispatchEvent(new DeviceOrientationEvent('deviceorientation', {alpha,beta:0,gamma:0}));
        await new Promise(r => setTimeout(r,20));
      }
    }, {alpha,speed,duration});
  };
  await pose(0,0);
  await phone.page.click('[data-act=calibrate]');
  await pose(-30,20);
  expect(await phone.page.textContent('.movement')).toContain('Phải');
  if (process.env.E2E_SHOTS) {
    await phone.page.screenshot({path: `${process.env.E2E_SHOTS}/motion-controller.png`});
    await host.page.screenshot({path: `${process.env.E2E_SHOTS}/motion-game.png`});
  }
  await pose(30,800,100);
  await pose(30,0);
  expect(await phone.page.textContent('.movement')).toBe('Tự đón bóng');
  await pose(0,0);
  await pose(30,20);
  expect(await phone.page.textContent('.movement')).toContain('Trái');
  await pose(0,0);
  expect(await phone.page.textContent('.movement')).toBe('Tự đón bóng');
  expect(await phone.page.locator('[data-screen=play] button').count()).toBe(2);
  expect(host.errors).toEqual([]);
});

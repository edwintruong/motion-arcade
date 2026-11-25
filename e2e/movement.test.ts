import { afterAll, afterEach, expect, test } from 'vitest';
import { closeBrowser, closePages, openHost, openPhone } from './helpers';

afterEach(closePages);
afterAll(closeBrowser);

test('phone steering uses sensors, stops during a stroke, and resets at neutral', async () => {
  const host = await openHost();
  const phone = await openPhone(host.code);
  await host.page.click('[data-mode=practice]');
  const pose = async (alpha: number, speed: number, duration = 500, acceleration = 0) => {
    await phone.page.evaluate(async ({alpha, speed, duration, acceleration}) => {
      const end = performance.now() + duration;
      while (performance.now() < end) {
        dispatchEvent(new DeviceMotionEvent('devicemotion', {rotationRate:{alpha:speed,beta:0,gamma:0},acceleration:{x:acceleration,y:0,z:0},interval:20}));
        dispatchEvent(new DeviceOrientationEvent('deviceorientation', {alpha,beta:0,gamma:0}));
        await new Promise(r => setTimeout(r,20));
      }
    }, {alpha,speed,duration,acceleration});
  };
  await pose(0,0);
  await phone.page.click('[data-act=calibrate]');
  // Moving the hand sideways with unchanged phone orientation must also work.
  await pose(0,0,160,2);
  expect(await phone.page.textContent('.movement')).toContain('Phải');
  await pose(0,0,160,-2);
  expect(await phone.page.textContent('.movement')).toContain('Phải');
  await pose(0,0,1000);
  expect(await phone.page.textContent('.movement')).toBe('Tự đón bóng');
  await pose(0,0,160,-2);
  expect(await phone.page.textContent('.movement')).toContain('Trái');
  await pose(0,0,1000);
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

import { afterAll, afterEach, expect, test } from 'vitest';
import type { Page } from 'playwright';
import { closeBrowser, closePages, openHost, openPhone } from './helpers';
afterEach(closePages);
afterAll(closeBrowser);

async function choose(page:Page,slot:number,id:string) {
  await page.click(`[data-character-slot="${slot}"]`);
  await page.click(`[data-character="${id}"]`);
  expect(await page.getAttribute(`[data-character="${id}"]`,'aria-pressed')).toBe('true');
  await page.click('.finish-roster');
}
test('six characters are selectable before pairing, persist, and appear in the match',async()=>{
  const host=await openHost();
  await choose(host.page,0,'yuki');
  expect(await host.page.locator('[data-character]').count()).toBe(6);
  await choose(host.page,1,'kuma');
  await host.page.reload();
  expect(await host.page.getAttribute('[data-character-slot="0"]','data-character-id')).toBe('yuki');
  expect(await host.page.getAttribute('[data-character-slot="1"]','data-character-id')).toBe('kuma');
  await host.page.waitForFunction(()=>/^[A-Z2-9]{4}$/.test(document.querySelector('.code')?.textContent??''));
  await openPhone((await host.page.textContent('.code'))!,{sensors:false});
  await host.page.click('[data-mode=ai][data-level=easy]');
  expect(await host.page.getAttribute('.lineup','data-characters')).toBe('yuki,kuma');
  await host.page.click('[data-act=menu]');
  await choose(host.page,0,'mimi');
  await host.page.click('[data-mode=practice]');
  expect(await host.page.getAttribute('.lineup','data-characters')).toBe('mimi,kuma');
  expect(host.errors).toEqual([]);
});
test('online peers see the same character choices on the correct court sides',async()=>{
  const a=await openHost(); const b=await openHost();
  await choose(a.page,0,'bao');await choose(b.page,0,'aiko');
  await openPhone(a.code,{sensors:false});await openPhone(b.code,{sensors:false});
  await a.page.click('[data-mode=online-create]');
  await b.page.fill('.match-code',a.code);await b.page.click('[data-mode=online-join]');
  for(const host of [a,b]) {
    await host.page.waitForFunction(()=>document.querySelector('.lineup')?.getAttribute('data-characters')==='bao,aiko');
    expect(host.errors).toEqual([]);
  }
});
test('invalid saved characters fall back without breaking the lobby',async()=>{
  const host=await openHost();
  await host.page.evaluate(()=>localStorage.setItem('pickle-garden.characters.v1','["unknown",null]'));
  await host.page.reload();
  expect(await host.page.getAttribute('[data-character-slot="0"]','data-character-id')).toBe('ren');
  expect(await host.page.getAttribute('[data-character-slot="1"]','data-character-id')).toBe('aiko');
  expect(host.errors).toEqual([]);
});

import { chromium } from 'playwright';
const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://localhost:3000/?role=host');
 await page.waitForFunction(()=>/^[A-Z2-9]{4}$/.test(document.querySelector('.code')?.textContent??''));
 await page.screenshot({path:'docs/garden-lobby.png'});
 const code=await page.textContent('.code');
 const phone=await browser.newPage({viewport:{width:390,height:844}}); await phone.goto('http://localhost:3000/?role=controller');
 await phone.fill('input',code); await phone.click('form button');
 const model=page.waitForResponse(r=>r.url().includes('pickle-garden.glb'));
 await page.click('[data-mode=ai][data-level=easy]');
 if(!(await model).ok()) throw new Error('Garden model unavailable');
 await page.waitForTimeout(2500);
 await page.screenshot({path:'docs/garden-game.png'});
 await phone.screenshot({path:'docs/garden-controller.png'});
 await page.click('[data-act=menu]');
 await page.locator('.menu').waitFor({state:'visible'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'docs/garden-mobile.png'});
 console.log(JSON.stringify({errors}));
 if(errors.length) process.exitCode=1;
} finally {await browser.close();}

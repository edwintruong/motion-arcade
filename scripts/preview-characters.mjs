import { chromium } from 'playwright';
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://localhost:3000/?role=host');
 await page.click('[data-character-slot="0"]');
 await page.locator('.character-art img').first().waitFor();
 await page.screenshot({path:'docs/character-roster.png'});
 await page.click('[data-character="yuki"]');
 await page.click('.finish-roster');
 await page.screenshot({path:'docs/character-lobby.png'});
 await page.setViewportSize({width:390,height:844});
 await page.click('[data-character-slot="0"]');
 await page.screenshot({path:'docs/character-mobile.png'});
 console.log('Character previews saved');
} finally {await browser.close();}

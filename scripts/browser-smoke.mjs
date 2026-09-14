import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn('python3',['-m','http.server','8080','--directory','docs'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<50;i++){
  try{const response=await fetch('http://127.0.0.1:8080');if(response.ok)break;}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 await mkdir('browser-artifacts',{recursive:true});
 browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 for(const [name,width,height,touch] of [['desktop',1280,720,false],['mobile-landscape',844,390,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8080');
  await page.locator('#start').click();await page.locator('#skipIntro').click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#bootError').textContent(),'');
  assert.ok(await page.locator('#hud').isVisible());
  const before=await page.locator('#position').textContent();
  if(touch){const box=await page.locator('[data-move="KeyW"]').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();}
  else await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  if(touch)await page.mouse.up();else await page.keyboard.up('KeyW');
  assert.notEqual(await page.locator('#position').textContent(),before,'Movement updates position');
  await page.screenshot({path:`browser-artifacts/${name}.png`});
  await page.evaluate(()=>document.exitPointerLock?.());
  await page.locator('#inventoryBtn').click();assert.ok(await page.locator('#inventory').isVisible());
  await page.locator('#inventory [data-close]').click();
  await page.locator('#pauseBtn').click();assert.ok(await page.locator('#pause').isVisible());
  await page.locator('#saveBtn').click();assert.match(await page.locator('#saveStatus').textContent(),/berhasil/);
  assert.deepEqual(errors,[]);console.log(`PASS ${name}: boot, movement, inventory, pause, save`);
  await context.close();
 }
}finally{await browser?.close();server.kill();}

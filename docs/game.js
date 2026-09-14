import {clamp,distance,recipes,names,fresh,pay,craft,loadSave,rng,rayBox,collides,traceScene} from './core.js';
import {Renderer,Geometry,vec,color} from './engine.js';
const $=id=>document.getElementById(id), canvas=$('world'), SAVE='fading-dawn-v1';
let renderer;
try{renderer=new Renderer(canvas);}catch(e){$('bootError').textContent=e.message;$('start').disabled=true;throw e;}
const palette={ground:color('596044'),road:color('64655e'),bark:color('51483b'),leaf:color('354f40'),leaf2:color('415b43'),stone:color('788278'),metal:color('65766d'),rust:color('a57144'),dark:color('263b36'),light:color('d1c4a0'),skin:color('ba987c'),cloth:color('677c6b'),red:color('bc5140')};
let state=fresh(), running=false, buildMode=false,piece='foundation',rotation=0,yaw=0,pitch=-.13;
let last=performance.now(), saveTimer=0, fireCooldown=0, reload=0, hitTime=0, hurtTime=0,moveTime=0;
let eye=vec(0,4.5,27),forward=vec(0,-.1,-1), toastUntil=0, nearest=null, candidate=null, audio=null;
let bgm=null,master=null,music=true,sound=true,openingTime=0;
const tracers=[];
const keys=new Set(), resources=[],enemies=[],staticBoxes=[],radio={x:22,z:-34};
const random=rng(781),rand=(a,b)=>a+(b-a)*random();
const staticGeo=new Geometry();
function box(g,x,y,z,w,h,d,c,r=0){g.box(x,y,z,w,h,d,c,r);}
function obstacle(x,z,w,h,d,c){box(staticGeo,x,h/2,z,w,h,d,c);staticBoxes.push({x,y:h/2,z,w,h,d});}
box(staticGeo,0,-.25,0,230,.5,230,palette.ground);
box(staticGeo,0,.012,-7,7,.025,125,palette.road);
for(let z=-66;z<60;z+=7)box(staticGeo,0,.04,z,.13,.025,2,color('b5af86'));
// Reference-inspired overgrown bridge approach. Deck remains level with the road.
const steel=color('353e43'), weathered=color('75664f');
box(staticGeo,-26,.018,-3,46,.035,6,palette.road);
for(const z of [-6.3,.3]){
 box(staticGeo,-26,5.8,z,44,.32,.32,steel);
 box(staticGeo,-26,.5,z,44,.25,.25,steel);
 staticBoxes.push({x:-26,y:2.9,z,w:44,h:5.8,d:.35});
 for(let x=-48;x<=-4;x+=5.5){
  box(staticGeo,x,2.9,z,.28,5.8,.28,steel);
  if(x<-4){staticGeo.beam(vec(x,.5,z),vec(x+5.5,5.8,z),.16,steel);staticGeo.beam(vec(x,5.8,z),vec(x+5.5,.5,z),.12,steel);}
 }
}
for(let x=-48;x<=-4;x+=5.5){box(staticGeo,x,5.8,-3,.24,.25,6.9,steel);}
// Roadside boards and concrete shoulders frame the approach.
for(const [x,z] of [[6,-12],[9,-26]]){
 obstacle(x,z,.16,2.8,.16,steel);
 box(staticGeo,x,2.4,z,1.6,.9,.13,weathered);
 box(staticGeo,x,2.42,z+.08,1.05,.10,.02,palette.light);
 box(staticGeo,x,2.19,z+.08,.65,.07,.02,palette.light);
}
// Horizon ridges are outside the walkable area.
for(let i=0;i<42;i++){const a=i/42*Math.PI*2;staticGeo.cone(Math.cos(a)*125,-1,Math.sin(a)*125,rand(14,28),rand(25,57),color(i%2?'546659':'465b53'),6);}
for(let i=0;i<220;i++){const x=rand(-85,85),z=rand(-85,75);if((x>-51&&x<-1&&z>-10&&z<4)||Math.abs(x)<6||Math.hypot(x,z-20)<11||Math.hypot(x-22,z+34)<14||Math.hypot(x+20,z+15)<13)continue;const h=rand(5,10);box(staticGeo,x,h*.35,z,.45,h*.7,.45,palette.bark);staticGeo.cone(x,h*.22,z,rand(1.8,2.7),h*.65,palette.leaf,7);staticGeo.cone(x,h*.51,z,rand(1.2,1.9),h*.56,palette.leaf2,7);staticBoxes.push({x,y:1.5,z,w:.6,h:3,d:.6});}
for(let i=0;i<210;i++){const x=rand(-74,74),z=rand(-72,68);if(Math.abs(x)<5)continue;staticGeo.cone(x,0,z,rand(.2,.5),rand(.2,.65),i%2?palette.leaf:palette.leaf2,4);}
// Deterministic grass blades, wildflowers and worn asphalt patches.
for(let i=0;i<2800;i++){
 const x=rand(-65,65),z=rand(-65,55);
 if(Math.abs(x)<3.6||(x>-49&&x<-3&&z>-6.5&&z<.6))continue;
 const h=rand(.12,.47),c=color(i%3?'6c7544':'87905c');
 staticGeo.tri(vec(x-.07,0,z),vec(x+.10,h,z+.04),vec(x+.07,0,z),c);
 staticGeo.tri(vec(x,0,z-.08),vec(x-.06,h*.8,z),vec(x,0,z+.08),c);
 if(i%27===0)staticGeo.ellipsoid(x,h,z,.07,.035,.07,color(i%2?'a5a0be':'c6c6ac'),6,4);
}
for(let i=0;i<75;i++){
 const x=rand(-3.1,3.1),z=rand(-65,54);
 box(staticGeo,x,.04,z,rand(.1,.6),.014,rand(.3,1.4),color('51534c'),rand(-.5,.5));
}
// Abandoned outpost: open doorways remain traversable.
function cabin(x,z){obstacle(x-4,z,.4,4,9,palette.metal);obstacle(x+4,z,.4,4,9,palette.metal);obstacle(x,z-4.5,8,4,.4,palette.metal);obstacle(x-2.8,z+4.5,2.4,4,.4,palette.metal);obstacle(x+2.8,z+4.5,2.4,4,.4,palette.metal);box(staticGeo,x,4.2,z,9,.35,10,palette.rust);box(staticGeo,x,.07,z,8,.14,9,color('555a50'));box(staticGeo,x,3.25,z+4.73,2.8,.45,.1,palette.dark);}
cabin(-20,-15);cabin(34,-40);
for(const x of [16,28]){obstacle(x,-34,.5,14,.5,palette.metal);box(staticGeo,x,7,-34,1.2,.2,1.2,palette.rust);}
box(staticGeo,22,13.5,-34,13,.35,.35,palette.metal);box(staticGeo,22,10,-34,12,.25,.25,palette.metal);box(staticGeo,22,16,-34,.2,6,.2,palette.rust);
obstacle(22,-34,2,1.6,1.2,palette.dark);box(staticGeo,22,1.1,-33.38,1.3,.6,.03,palette.rust);
// Starter camp and readable supply trail.
box(staticGeo,-4,.25,21,1.5,.5,.7,palette.bark);box(staticGeo,4,.25,21,1.5,.5,.7,palette.bark);
function resource(type,x,z){resources.push({id:resources.length,type,x,z});}
[['wood',-5,14],['stone',4,13],['scrap',6,7],['supply',-5,20],['wood',-6,9],['stone',-4,4],['scrap',3,-3],['supply',-20,-13],['scrap',-22,-16],['scrap',34,-39]].forEach(a=>resource(...a));
for(let i=0;i<76;i++){const x=rand(-62,62),z=rand(-62,48);if(collides(x,z,staticBoxes,1))continue;resource(['wood','stone','scrap','supply'][i%4],x,z);}
const enemySpawns=[[-9,0],[10,-7],[-13,-23],[9,-27],[18,-24],[26,-27],[34,-25],[26,-44]];
enemySpawns.forEach(([x,z],id)=>enemies.push({id,x,z,homeX:x,homeZ:z,hp:90,cool:0,phase:rand(0,6.2)}));
renderer.upload(staticGeo);
const allDialogs=[...document.querySelectorAll('dialog')];
const isPaused=()=>allDialogs.some(d=>d.open)||openingTime>0;
function toast(s){$('toast').textContent=s;toastUntil=performance.now()+3200;}
function saved(){try{return loadSave(localStorage.getItem(SAVE));}catch{return null;}}
function save(silent=false){if(!running||state.health<=0)return false;try{localStorage.setItem(SAVE,JSON.stringify(state));if(!silent)toast('Progres tersimpan di browser ini.');$('saveStatus').textContent='Progres berhasil disimpan.';return true;}catch{$('saveStatus').textContent='Penyimpanan tidak tersedia. Perjalanan ini tidak dapat disimpan.';if(!silent)toast('Browser tidak mengizinkan penyimpanan.');return false;}}
function unlock(){if(document.pointerLockElement)document.exitPointerLock();keys.clear();}
function openPanel(id){if(openingTime>0)return;unlock();$(id).showModal();updateInventory();}
function closePanels(){for(const d of allDialogs)if(d.open)d.close();keys.clear();}
function lock(){if(matchMedia('(pointer:coarse)').matches)return;try{const result=canvas.requestPointerLock?.();result?.catch(()=>toast('Geser sambil menekan mouse untuk melihat; Spasi untuk menembak.'));}catch{}}
function begin(resume=false){closePanels();state=resume&&saved()?saved():fresh();for(const e of enemies){e.hp=state.killed.includes(e.id)?0:90;e.x=e.homeX;e.z=e.homeZ;e.cool=0;}yaw=0;pitch=-.13;reload=0;fireCooldown=0;saveTimer=0;buildMode=false;tracers.length=0;running=true;$('menu').hidden=true;$('hud').hidden=false;$('buildHud').hidden=true;setupAudio();if(!resume){openingTime=12;$('opening').hidden=false;}else{lock();toast('Perjalanan dilanjutkan. E untuk mengambil persediaan.');}updateHUD();}
function setupAudio(){try{if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=.16;master.connect(audio.destination);const osc=audio.createOscillator();bgm=audio.createGain();bgm.gain.value=.06;osc.type='sine';osc.frequency.value=65.4;osc.connect(bgm);bgm.connect(master);osc.start();const second=audio.createOscillator();second.type='sine';second.frequency.value=98;second.connect(bgm);second.start();}audio.resume().catch(()=>{});}catch{}}
function tone(freq,duration=.12,type='sine'){if(!audio||!sound)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.45),audio.currentTime+duration);gain.gain.setValueAtTime(.5,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(master);osc.start();osc.stop(audio.currentTime+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
function buildingsBoxes(){return state.buildings.filter(b=>b.type==='wall').map(b=>({x:b.x,y:1.45,z:b.z,w:b.r? .3:4,h:2.9,d:b.r?4:.3}));}
function obstacles(){return [...staticBoxes,...buildingsBoxes()];}
function moveEntity(e,dx,dz,boxes,r=.38){const nx=clamp(e.x+dx,-74,74),nz=clamp(e.z+dz,-74,74);if(!collides(nx,e.z,boxes,r))e.x=nx;if(!collides(e.x,nz,boxes,r))e.z=nz;}
function camera(){forward=vec(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));const anchor=vec(state.x,1.7,state.z),desired=vec(anchor.x-forward.x*5,anchor.y-forward.y*5+.65,anchor.z-forward.z*5);const dir=vec(desired.x-anchor.x,desired.y-anchor.y,desired.z-anchor.z),len=Math.hypot(dir.x,dir.y,dir.z);dir.x/=len;dir.y/=len;dir.z/=len;let limit=len;for(const b of obstacles()){const hit=rayBox(anchor,dir,b,len);if(hit!==null)limit=Math.min(limit,Math.max(.15,hit-.3));}eye=vec(anchor.x+dir.x*limit,Math.max(.5,anchor.y+dir.y*limit),anchor.z+dir.z*limit);return vec(eye.x+forward.x*10,eye.y+forward.y*10,eye.z+forward.z*10);}
function attack(melee=false){
 if(!running||isPaused()||fireCooldown>0)return;
 if(buildMode&&!melee){place();return;}
 if(!melee&&(reload>0||state.mag<=0)){if(state.mag<=0)startReload();return;}
 fireCooldown=melee?.55:.25;
 if(!melee)state.mag--;
 tone(melee?120:85,melee?.09:.17,melee?'triangle':'sawtooth');
 let target=null;
 const boxes=obstacles();
 if(melee){
  for(const e of enemies){
   if(e.hp<=0||distance(e,state)>2.5)continue;
   const dx=e.x-state.x,dz=e.z-state.z,len=Math.hypot(dx,dz)||.001;
   if((dx*Math.sin(yaw)-dz*Math.cos(yaw))/len<.25)continue;
   const origin=vec(state.x,1.1,state.z),dir=vec(dx/len,0,dz/len);
   if(boxes.some(b=>{const h=rayBox(origin,dir,b,len);return h!==null&&h<len-.5;}))continue;
   target=e;break;
  }
 }else{
  camera();
  const aim=traceScene(eye,forward,boxes,enemies);
  const point=vec(eye.x+forward.x*aim.distance,eye.y+forward.y*aim.distance,eye.z+forward.z*aim.distance);
  const muzzle=vec(state.x+.43*Math.cos(yaw)+.64*Math.sin(yaw),1.3,state.z+.43*Math.sin(yaw)-.64*Math.cos(yaw));
  const delta=vec(point.x-muzzle.x,point.y-muzzle.y,point.z-muzzle.z),length=Math.hypot(delta.x,delta.y,delta.z)||1;
  const dir=vec(delta.x/length,delta.y/length,delta.z/length);
  const shot=traceScene(muzzle,dir,boxes,enemies,length+.05);
  target=enemies.find(e=>e.id===shot.enemyId)||null;
  const impact=vec(muzzle.x+dir.x*shot.distance,muzzle.y+dir.y*shot.distance,muzzle.z+dir.z*shot.distance);
  tracers.push({from:muzzle,to:impact,life:.10,hit:!!target});
 }
 if(target){
  target.hp-=melee?35:45;hitTime=.18;
  if(target.hp<=0){
   state.killed.push(target.id);state.inventory.scrap+=2;state.inventory.ammo+=4;
   toast('Ancaman dihentikan · +2 komponen · +4 peluru');
  }
 }
 updateHUD();
}
function startReload(){if(!running||isPaused()||reload>0||state.mag>=12)return;if(state.inventory.ammo<1){toast('Peluru habis. Buat peluru di tas atau gunakan F untuk memukul.');return;}reload=1.5;tone(180,.1,'triangle');}
function interact(){if(!running||isPaused())return;if(distance(state,radio)<3.3){if(state.won){toast('Sinyal stabil. Bantuan sedang menuju sektormu.');return;}const built=['foundation','wall','door'].every(t=>state.buildings.some(b=>b.type===t));if(!built||state.killed.length<3){toast('Bangun fondasi, dinding, pintu; kalahkan 3 musuh sebelum menyalakan radio.');return;}if(!pay(state.inventory,recipes.radio)){toast('Radio membutuhkan 5 komponen dan 4 batu.');return;}state.won=true;save(true);tone(680,.6);$('endTag').textContent='CHAPTER 01 SELESAI';$('endTitle').textContent='Ada yang mendengarmu.';$('endText').textContent='Sinyal pulih. Di antara kabut dan reruntuhan, suara manusia kembali terdengar. Perjalanan berikutnya belum ditulis.';$('endAction').textContent='Lanjutkan eksplorasi';openPanel('ending');return;}if(!nearest){toast('Dekati batang tumbang, batu, atau peti persediaan.');return;}if(state.collected.includes(nearest.id))return;state.collected.push(nearest.id);if(nearest.type==='supply'){state.inventory.food++;state.inventory.water++;toast('+1 ransum · +1 air');}else{const n=nearest.type==='wood'?4:nearest.type==='stone'?3:2;state.inventory[nearest.type]+=n;toast(`+${n} ${names[nearest.type]}`);}nearest=null;tone(520,.12);updateHUD();}
function toggleBuild(){if(!running||isPaused())return;buildMode=!buildMode;$('buildHud').hidden=!buildMode;toast(buildMode?'Bangun di area terbuka. Pilih 1, 2, 3; Q untuk putar.':'Mode bangun ditutup.');}
function buildCandidate(){const x=Math.round((state.x+Math.sin(yaw)*4.5)/4)*4,z=Math.round((state.z-Math.cos(yaw)*4.5)/4)*4;const c={x,z,r:rotation,type:piece};if(piece!=='foundation'){const foundations=state.buildings.filter(b=>b.type==='foundation').sort((a,b)=>distance(a,c)-distance(b,c));const base=foundations[0];if(base&&distance(base,c)<6){if(rotation){c.x=base.x+(state.x>base.x?2:-2);c.z=base.z;}else{c.x=base.x;c.z=base.z+(state.z>base.z?2:-2);}}}const cost=recipes[piece],canPay=Object.entries(cost).every(([k,v])=>state.inventory[k]>=v);const w=piece==='foundation'?4:rotation?.3:4,d=piece==='foundation'?4:rotation?4:.3;const blocked=obstacles().some(b=>Math.abs(c.x-b.x)<(w+b.w)/2+.1&&Math.abs(c.z-b.z)<(d+b.d)/2+.1);const same=state.buildings.some(b=>b.type===c.type&&distance(c,b)<.1&&b.r===c.r);const hasBase=piece==='foundation'||state.buildings.some(b=>b.type==='foundation'&&distance(b,c)<=2.1);const playerOverlap=Math.abs(c.x-state.x)<w/2+.5&&Math.abs(c.z-state.z)<d/2+.5;c.valid=canPay&&!blocked&&!same&&hasBase&&!playerOverlap&&distance(c,radio)>5&&Math.abs(c.x)<70&&Math.abs(c.z)<70&&state.buildings.length<100;return c;}
function place(){if(!candidate?.valid){toast('Tidak bisa dipasang: periksa bahan, ruang, dan fondasi.');return;}if(!pay(state.inventory,recipes[piece]))return;state.buildings.push({x:candidate.x,z:candidate.z,r:rotation,type:piece});tone(220,.18,'triangle');toast(`${names[piece]} terpasang.`);updateHUD();}
function useItem(kind){if(state.inventory[kind]<1)return;const stat=kind==='food'?'hunger':kind==='water'?'thirst':'health';if(state[stat]>=100){$('inventoryStatus').textContent='Kondisimu sudah penuh.';return;}state.inventory[kind]--;state[stat]=Math.min(100,state[stat]+(kind==='food'?35:40));$('inventoryStatus').textContent=`${names[kind]} digunakan.`;tone(380,.14);updateInventory();updateHUD();}
function updateInventory(){$('items').innerHTML=Object.entries(state.inventory).map(([k,v])=>`<div class="item"><b>${v}</b><span>${names[k]}</span></div>`).join('');for(const b of document.querySelectorAll('[data-use]'))b.disabled=state.inventory[b.dataset.use]<1;for(const b of document.querySelectorAll('[data-craft]'))b.disabled=Object.entries(recipes[b.dataset.craft]).some(([k,v])=>state.inventory[k]<v);}
function updateHUD(){updateGuide();for(const k of ['health','hunger','thirst'])$(k+'Value').textContent=Math.ceil(state[k]);$('healthBar').style.width=state.health+'%';$('staminaBar').style.width=state.stamina+'%';$('mag').textContent=state.mag.toString().padStart(2,'0');$('reserve').textContent='/ '+state.inventory.ammo;$('reloadLabel').textContent=reload>0?'MENGISI ULANG…':'R — ISI ULANG';const rows=[['foundation','Bangun fondasi'],['wall','Pasang dinding'],['door','Pasang pintu']];$('objectives').innerHTML=rows.map(([k,label])=>{const done=state.buildings.some(b=>b.type===k);return `<p class="${done?'done':''}">${done?'✓':'◇'} ${label}</p>`;}).join('')+`<p class="${state.killed.length>=3?'done':''}">${state.killed.length>=3?'✓':'◇'} Hentikan ancaman ${Math.min(3,state.killed.length)}/3</p><p class="${state.won?'done':''}">${state.won?'✓':'◇'} Aktifkan radio · ${Math.round(distance(state,radio))} m</p>`;const deg=((yaw*180/Math.PI)%360+360)%360;const dirs=['N','NE','E','SE','S','SW','W','NW'];$('bearing').textContent=`${dirs[Math.round(deg/45)%8]} · ${Math.round(deg).toString().padStart(3,'0')}°`;const minutes=17*60+Math.floor(state.time/4);$('clock').textContent=`HARI ${String(1+Math.floor(minutes/1440)).padStart(2,'0')} / ${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;$('position').textContent=`${Math.round(state.x)}, ${Math.round(state.z)}`;if(buildMode)$('buildLabel').textContent=`${names[piece]} · `+Object.entries(recipes[piece]).map(([k,v])=>`${v} ${names[k]}`).join(' + ');}
function updateGuide(){
 const has=type=>state.buildings.some(b=>b.type===type);
 let text;
 if(state.won)text='Radio pulih. Kamu bisa melanjutkan eksplorasi.';
 else if(state.collected.length===0)text='Langkah 1 · Dekati batang atau peti. Tekan E untuk mengambil.';
 else if(!has('foundation'))text=state.inventory.wood>=6&&state.inventory.stone>=2?'Bahan fondasi cukup. Tekan B, lalu pasang di area terbuka.':`Kumpulkan bahan fondasi: kayu ${state.inventory.wood}/6 · batu ${state.inventory.stone}/2.`;
 else if(!has('wall'))text='Fondasi selesai. Dalam mode bangun (B), pilih 2 untuk memasang dinding pada tepinya.';
 else if(!has('door'))text='Pasang pintu pada sisi fondasi yang kosong. Mode bangun: B; pilih 3; Q untuk putar.';
 else if(state.killed.length<3)text=`Perlindungan siap. Hentikan ${3-state.killed.length} ancaman lagi. Titik merah terlihat di peta.`;
 else text=`Menuju menara: siapkan komponen ${state.inventory.scrap}/5 dan batu ${state.inventory.stone}/4.`;
 $('nextStep').textContent=text;
}
const figureCache=new Map();
function figure(g,x,z,c,t,enemy=false,facing=0){
 const pose=Math.round(((t%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*24)%24;
 const key=`${enemy}/${c.join(",")}/${pose}`;
 let model=figureCache.get(key);
 if(!model){
 model=new Geometry();
 const step=Math.sin(pose/24*Math.PI*2)*.23;
 const rounded=(x,y,z,rx,ry,rz,col)=>model.ellipsoid(x,y,z,rx,ry,rz,col);
 const trousers=enemy?c:color('454c50'),top=enemy?c:color('48484b');
 rounded(-.17,.48,step,.15,.46,.16,trousers);
 rounded(.17,.48,-step,.15,.46,.16,trousers);
 rounded(-.17,.12,step-.10,.16,.13,.25,palette.dark);
 rounded(.17,.12,-step-.10,.16,.13,.25,palette.dark);
 rounded(0,.95,0,.30,.22,.20,trousers);
 rounded(0,1.17,0,.23,.21,.17,enemy?c:palette.skin);
 rounded(0,1.43,0,.33,.25,.21,top);
 rounded(0,1.70,0,.09,.13,.09,palette.skin);
 rounded(0,1.89,0,.20,.25,.20,enemy?palette.metal:palette.skin);
 rounded(-.40,1.38,-step,.105,.24,.11,enemy?c:palette.skin);
 rounded(-.43,1.11,-step-.08,.10,.20,.10,enemy?c:palette.skin);
 rounded(.40,1.38,step,.105,.24,.11,enemy?c:palette.skin);
 rounded(.43,1.16,enemy?step:-.19,.10,.18,.10,enemy?c:palette.skin);
 if(enemy){box(model,0,1.91,-.196,.26,.045,.03,palette.red);}
 else{
  const hair=color('664239');
  rounded(0,2.03,.035,.215,.16,.205,hair);
  rounded(0,1.86,.16,.22,.24,.09,hair);
  rounded(-.18,1.9,.035,.06,.23,.17,hair);
  rounded(.18,1.9,.035,.06,.23,.17,hair);
  box(model,0,1.39,.23,.37,.42,.16,palette.dark);
  model.beam(vec(-.25,1.62,.24),vec(.18,1.13,.24),.025,palette.dark);
  model.beam(vec(.25,1.62,.24),vec(-.18,1.13,.24),.025,palette.dark);
  box(model,.43,1.3,-.35,.14,.17,.65,palette.dark);
 }
 figureCache.set(key,model);
 }
 const cos=Math.cos(facing),sin=Math.sin(facing);
 for(let i=0;i<model.data.length;i+=9){
  const d=model.data;
  g.data.push(x+d[i]*cos-d[i+2]*sin,d[i+1],z+d[i]*sin+d[i+2]*cos,
   d[i+3]*cos-d[i+5]*sin,d[i+4],d[i+3]*sin+d[i+5]*cos,d[i+6],d[i+7],d[i+8]);
 }
}
function building(g,b,ghost=false){const c=ghost?(b.valid?color('82bf99'):color('cb604c')):palette.bark;if(b.type==='foundation'){box(g,b.x,.12,b.z,3.95,.24,3.95,c);for(let i=-1.6;i<2;i+=.65)box(g,b.x,.25,b.z+i,3.95,.025,.025,palette.dark);}else if(b.type==='wall'){box(g,b.x,1.5,b.z,b.r?.25:4,3,b.r?4:.25,c);}else{const offset=b.r?0:1.6,oz=b.r?1.6:0;box(g,b.x-offset,1.4,b.z-oz,b.r?.28:.8,2.8,b.r?.8:.28,c);box(g,b.x+offset,1.4,b.z+oz,b.r?.28:.8,2.8,b.r?.8:.28,c);box(g,b.x,2.7,b.z,b.r?.28:4,.6,b.r?4:.28,c);}}
function dynamicGeometry(){const g=new Geometry();for(const r of resources){if(state.collected.includes(r.id))continue;if(r.type==='wood'){box(g,r.x,.28,r.z,1.5,.56,.6,palette.bark);box(g,r.x+.77,.28,r.z,.02,.4,.4,palette.light);}else if(r.type==='stone'){g.cone(r.x,0,r.z,.8,.85,palette.stone,6);}else{box(g,r.x,.42,r.z,.85,.84,.85,r.type==='scrap'?palette.rust:palette.leaf2);box(g,r.x,.86,r.z,.9,.08,.9,palette.light);box(g,r.x,.45,r.z+.43,.1,.5,.02,palette.light);}}for(const b of state.buildings)building(g,b);if(buildMode&&candidate)building(g,candidate,true);if(running)figure(g,state.x,state.z,palette.cloth,moveTime,false,yaw);for(const e of enemies)if(e.hp>0){figure(g,e.x,e.z,palette.dark,state.time*5+e.phase,true,Math.atan2(state.x-e.x,-(state.z-e.z)));if(e.hp<90)box(g,e.x,2.4,e.z,e.hp/90,.06,.05,palette.red);}for(const shot of tracers){
 g.beam(shot.from,shot.to,.018,color('f5c685'));
 box(g,shot.from.x,shot.from.y,shot.from.z,.13,.13,.13,color('ffdca0'));
 if(shot.hit)box(g,shot.to.x,shot.to.y,shot.to.z,.15,.15,.15,palette.rust);
}const glow=state.won?color('a5e6b0'):palette.rust;box(g,22,1.15,-33.35,.35,.16,.05,glow);return g;}
function drawMap(){const ctx=$('map').getContext('2d'),size=168;ctx.clearRect(0,0,size,size);ctx.fillStyle='#182a25';ctx.fillRect(0,0,size,size);ctx.strokeStyle='#57715c40';for(let i=0;i<size;i+=28){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,size);ctx.moveTo(0,i);ctx.lineTo(size,i);ctx.stroke();}const point=(x,z)=>[84+x*.9,84+z*.9];ctx.fillStyle='#77816e';ctx.fillRect(81,12,6,126);const [bx,bz]=point(-48,-3);ctx.fillStyle='#bdad8d';ctx.fillRect(bx,bz-3,44*.9,6);ctx.strokeStyle='#e1d0af';ctx.strokeRect(bx,bz-3,44*.9,6);ctx.fillStyle='#6e7e6b';for(const c of [[-20,-15],[34,-40]]){const [x,y]=point(...c);ctx.fillRect(x-4,y-5,8,10);}ctx.fillStyle='#e2ab6f';const [rx,rz]=point(radio.x,radio.z);ctx.fillRect(rx-3,rz-3,6,6);ctx.fillStyle='#cd725e';for(const e of enemies)if(e.hp>0){const [x,y]=point(e.x,e.z);ctx.beginPath();ctx.arc(x,y,2,0,7);ctx.fill();}const [x,y]=point(state.x,state.z);ctx.save();ctx.translate(x,y);ctx.rotate(yaw);ctx.fillStyle='#f3efe0';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(-4,4);ctx.lineTo(4,4);ctx.closePath();ctx.fill();ctx.restore();}
function tick(dt){
 for(let i=tracers.length-1;i>=0;i--){tracers[i].life-=dt;if(tracers[i].life<=0)tracers.splice(i,1);}
 state.time+=dt;saveTimer+=dt;fireCooldown=Math.max(0,fireCooldown-dt);hitTime=Math.max(0,hitTime-dt);hurtTime=Math.max(0,hurtTime-dt);if(reload>0){reload-=dt;if(reload<=0){const n=Math.min(12-state.mag,state.inventory.ammo);state.mag+=n;state.inventory.ammo-=n;tone(240,.08);}}const walk=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),length=Math.hypot(walk,side);const sprint=keys.has('ShiftLeft')&&state.stamina>2&&length>0;const speed=sprint?7.5:4.2;if(length){moveEntity(state,(walk*Math.sin(yaw)+side*Math.cos(yaw))/length*speed*dt,(-walk*Math.cos(yaw)+side*Math.sin(yaw))/length*speed*dt,obstacles());moveTime+=dt*(sprint?13:9);}else{moveTime=0;}state.stamina=clamp(state.stamina+dt*(sprint?-20:14),0,100);state.hunger=clamp(state.hunger-dt*.035,0,100);state.thirst=clamp(state.thirst-dt*(sprint?.1:.055),0,100);if(state.hunger<=0||state.thirst<=0)state.health=Math.max(0,state.health-dt*1.5);const boxes=obstacles();for(const e of enemies){if(e.hp<=0)continue;e.cool=Math.max(0,e.cool-dt);const d=distance(state,e);if(d<17&&d>1.25)moveEntity(e,(state.x-e.x)/d*1.75*dt,(state.z-e.z)/d*1.75*dt,boxes,.38);if(d<1.7&&e.cool<=0){const dx=state.x-e.x,dz=state.z-e.z,len=Math.hypot(dx,dz)||1;if(!boxes.some(b=>rayBox(vec(e.x,1,e.z),vec(dx/len,0,dz/len),b,len)!==null)){state.health=Math.max(0,state.health-9);e.cool=1.3;hurtTime=.6;tone(50,.18,'triangle');}}}nearest=null;let best=2.7;for(const r of resources){const d=distance(r,state);if(d<best&&!state.collected.includes(r.id)){nearest=r;best=d;}}if(buildMode){candidate=buildCandidate();$('prompt').textContent=candidate.valid?'Klik / Pasang untuk membangun':'Bahan atau posisi belum sesuai';}else if(distance(state,radio)<3.3){$('prompt').textContent='E · Radio — 5 komponen + 4 batu';}else{$('prompt').textContent=nearest?`E · Ambil ${nearest.type==='supply'?'persediaan':names[nearest.type]}`:'';}if(state.health<=0){$('endTag').textContent='PERJALANAN TERHENTI';$('endTitle').textContent='Hutan kembali sunyi.';$('endText').textContent='Lanjutkan dari progres terakhir yang tersimpan. Gunakan persediaan dari tas dan hindari menghadapi banyak musuh sekaligus.';$('endAction').textContent=saved()?'Muat progres terakhir':'Coba perjalanan baru';openPanel('ending');}if(saveTimer>=15){save(true);saveTimer=0;}updateHUD();}
let hudTimer=0;
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;try{if(running&&!isPaused())tick(dt);if(openingTime>0){openingTime-=dt;const progress=12-openingTime;$('openingText').textContent=progress<4?'Sektor 07. Tidak ada kabar sejak senja.':progress<8?'Persediaan menipis. Menara radio masih diam.':'Temukan perlindungan. Pulihkan sinyal.';if(openingTime<=0)$('opening').hidden=true;}let target;if(running){target=camera();}else{const t=now*.000035;eye=vec(42+Math.sin(t)*12,12,28+Math.cos(t)*10);target=vec(12,2,-25);}const light=running?.87+.13*Math.cos(state.time/480):1;renderer.render(eye,target,dynamicGeometry(),light);hudTimer+=dt;if(hudTimer>.1){drawMap();hudTimer=0;}$('hitmarker').hidden=hitTime<=0;$('damage').style.opacity=hurtTime>0?.5:0;if(toastUntil&&now>toastUntil){$('toast').textContent='';toastUntil=0;}if(bgm)bgm.gain.value=music&&running&&!isPaused()?.06:0;requestAnimationFrame(frame);}catch(e){unlock();running=false;$('menu').hidden=false;$('hud').hidden=true;$('bootError').textContent='Permainan berhenti: '+e.message;console.error(e);}}
function choosePiece(type){piece=type;updateHUD();}
$('start').onclick=()=>saved()?openReset():begin(false);$('continue').hidden=!saved();$('continue').onclick=()=>begin(true);
$('inventoryBtn').onclick=()=>openPanel('inventory');$('pauseBtn').onclick=()=>openPanel('pause');$('buildBtn').onclick=toggleBuild;$('helpBtn').onclick=()=>openPanel('help');$('resume').onclick=()=>{closePanels();lock();};$('saveBtn').onclick=()=>save();$('restartBtn').onclick=openReset;
function openReset(){unlock();$('reset').showModal();}
$('confirmReset').onclick=()=>{try{localStorage.removeItem(SAVE);}catch{}begin(false);};
$('endAction').onclick=()=>state.health<=0?begin(!!saved()):closePanels();
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
for(const b of document.querySelectorAll('[data-use]'))b.onclick=()=>useItem(b.dataset.use);
for(const b of document.querySelectorAll('[data-craft]'))b.onclick=()=>{if(craft(state.inventory,b.dataset.craft)){tone(400,.15);$('inventoryStatus').textContent=`${names[b.dataset.craft]} berhasil dibuat.`;updateInventory();updateHUD();}};
for(const b of document.querySelectorAll('[data-piece]'))b.onclick=()=>choosePiece(b.dataset.piece);
$('rotateBtn').onclick=()=>rotation=rotation?0:1;$('touchUse').onclick=interact;$('touchMelee').onclick=()=>attack(true);$('touchReload').onclick=startReload;$('touchFire').onclick=()=>attack();
for(const b of document.querySelectorAll('[data-move]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.move);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.move);}
document.addEventListener('keydown',e=>{
 if(!running||e.repeat)return;
 if(e.code==='KeyI'&&$('inventory').open){e.preventDefault();$('inventory').close();keys.clear();return;}
 if(e.code==='KeyP'||e.code==='Escape'){
  e.preventDefault();
  if($('pause').open){$('pause').close();keys.clear();}
  else if(!isPaused())openPanel('pause');
  else if(!$('ending').open&&!$('reset').open&&openingTime<=0)closePanels();
  return;
 }
 if(isPaused())return;
 if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
 keys.add(e.code);
 if(e.code==='Space')attack();
 if(e.code==='KeyE')interact();
 if(e.code==='KeyR')startReload();
 if(e.code==='KeyF')attack(true);
 if(e.code==='KeyI')openPanel('inventory');
 if(e.code==='KeyB')toggleBuild();
 if(e.code==='KeyQ')rotation=rotation?0:1;
 if(e.code==='Slash')openPanel('help');
 if(buildMode&&['Digit1','Digit2','Digit3'].includes(e.code))choosePiece(['foundation','wall','door'][Number(e.code.at(-1))-1]);
});
$('ending').addEventListener('cancel',e=>{if(state.health<=0)e.preventDefault();});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(running&&!isPaused())openPanel('pause');});document.addEventListener('visibilitychange',()=>{if(document.hidden){save(true);keys.clear();if(running&&!isPaused())openPanel('pause');}});
document.addEventListener('pointerlockchange',()=>{keys.clear();});
let dragging=false,px=0,py=0;
canvas.addEventListener('pointerdown',e=>{if(!running||isPaused())return;if(e.pointerType==='touch'){dragging=true;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId);}else if(document.pointerLockElement===canvas){if(e.button===0)attack();else if(e.button===2)attack(true);}else{dragging=true;px=e.clientX;py=e.clientY;lock();}});
canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointermove',e=>{if(!running||isPaused())return;let dx=0,dy=0;if(document.pointerLockElement===canvas){dx=e.movementX;dy=e.movementY;}else if(dragging){dx=e.clientX-px;dy=e.clientY-py;px=e.clientX;py=e.clientY;}else return;yaw+=dx*.003;pitch=clamp(pitch-dy*.003,-.65,.5);});
window.addEventListener('pagehide',()=>save(true));canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();save(true);unlock();running=false;closePanels();$('menu').hidden=false;$('hud').hidden=true;$('start').disabled=true;$('continue').disabled=true;$('bootError').textContent='Koneksi grafis terputus. Muat ulang halaman untuk melanjutkan dari progres tersimpan.';});
// Lightweight UI for course-required intro, audio controls, and credits.
const opening=document.createElement('section');opening.id='opening';opening.hidden=true;opening.innerHTML='<div class="eyebrow">FADING DAWN / SINYAL TERAKHIR</div><h2 id="openingText"></h2><button id="skipIntro">Lewati pembuka</button>';document.body.append(opening);$('skipIntro').onclick=()=>{openingTime=0;opening.hidden=true;lock();};
const status=document.createElement('p');status.id='inventoryStatus';status.setAttribute('role','status');$('inventory').append(status);
const settings=document.createElement('div');settings.className='actions';settings.innerHTML='<button id="musicBtn" aria-pressed="true">Musik: aktif</button><button id="soundBtn" aria-pressed="true">Efek: aktif</button>';$('pause').append(settings);
$('musicBtn').onclick=()=>{music=!music;$('musicBtn').textContent=`Musik: ${music?'aktif':'mati'}`;$('musicBtn').setAttribute('aria-pressed',music);};$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').textContent=`Efek: ${sound?'aktif':'mati'}`;$('soundBtn').setAttribute('aria-pressed',sound);};
const credits=document.createElement('p');credits.className='small';credits.textContent='Fading Dawn · Proyek NourAnisa. Visual geometri dan audio sintetis dibuat untuk proyek ini. Pengembangan kode dibantu AI. Inspirasi genre: Once Human dan LifeAfter.';$('help').append(credits);
requestAnimationFrame(frame);

// Optional, read-only status for browsers implementing WebMCP.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  try{Promise.resolve(document.modelContext.registerTool({
    name:'read_survival_status',title:'Status Fading Dawn',
    description:'Read the current on-screen health, inventory, objectives and game status.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true},
    execute(input){if(input===null||typeof input!=='object'||Object.keys(input).length)throw Error('Expected an empty object');return {started:running,paused:isPaused(),health:state.health,inventory:{...state.inventory},enemiesDefeated:state.killed.length,radioRestored:state.won};}
  },{signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}

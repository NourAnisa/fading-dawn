// Runs actual game state transitions against DOM/render/audio doubles.
// These are logic integration tests, not browser or visual playtests.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as core from '../docs/core.js';
import * as engine from '../docs/engine.js';
function harness(){
 const elements=new Map(),store=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{id,hidden:false,open:false,textContent:'',style:{},classList:{},append(){},setAttribute(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},getContext(){return {};}});return elements.get(id);};
 const dialogs=['inventory','pause','help','ending','reset'].map(get);
 const document={getElementById:get,querySelectorAll:s=>s==='dialog'?dialogs:[],createElement:()=>({append(){},setAttribute(){}}),body:{append(){}},addEventListener(){}};
 const context=vm.createContext({...core,...engine,Renderer:class{upload(){}render(){}},document,window:{addEventListener(){}},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},performance:{now:()=>100},requestAnimationFrame(){},console,matchMedia:()=>({matches:true}),AbortController});
 const source=readFileSync(new URL('../docs/game.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');vm.runInContext(source,context);
 return {run:code=>vm.runInContext(code,context),elements};
}
test('new game starts; gathering twice cannot duplicate the same node',()=>{const h=harness();h.run('begin(false);openingTime=0;nearest=resources[0];interact();');assert.equal(h.run('state.inventory.wood'),4);h.run('nearest=resources[0];interact();');assert.equal(h.run('state.inventory.wood'),4);});
test('foundation, wall and opposite door can all be placed without overlap',()=>{const h=harness();h.run('begin(false);openingTime=0;state.inventory.wood=20;state.inventory.stone=10;state.inventory.scrap=10;state.x=8;state.z=20;yaw=0;buildMode=true;candidate=buildCandidate();');assert.equal(h.run('candidate.valid'),true);h.run('place();piece="wall";candidate=buildCandidate();');assert.equal(h.run('candidate.valid'),true);h.run('place();state.z=12;yaw=Math.PI;piece="door";candidate=buildCandidate();');assert.equal(h.run('candidate.valid'),true);h.run('place();');assert.equal(h.run('state.buildings.length'),3);});
test('radio rejects incomplete mission, then completes and persists a qualified mission',()=>{const h=harness();h.run('begin(false);openingTime=0;state.x=22;state.z=-32;state.inventory.scrap=5;state.inventory.stone=4;interact();');assert.equal(h.run('state.won'),false);assert.equal(h.run('state.inventory.scrap'),5);h.run('state.buildings=[{type:"foundation",x:8,z:16,r:0},{type:"wall",x:8,z:18,r:0},{type:"door",x:8,z:14,r:0}];state.killed=[0,1,2];interact();');assert.equal(h.run('state.won'),true);assert.equal(h.run('saved().won'),true);assert.equal(h.elements.get('ending').open,true);});
test('reload transfers only available ammo and health depletion opens game over',()=>{const h=harness();h.run('begin(false);openingTime=0;state.mag=10;state.inventory.ammo=1;startReload();tick(1.6);');assert.equal(h.run('state.mag'),11);assert.equal(h.run('state.inventory.ammo'),0);h.run('state.health=.1;state.hunger=0;tick(.1);');assert.equal(h.run('state.health'),0);assert.equal(h.elements.get('ending').open,true);});

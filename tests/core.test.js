import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,pay,craft,loadSave,rayBox,collides,rng,traceScene} from '../docs/core.js';
import {Geometry,lookAt,perspective,vec} from '../docs/engine.js';

test('failed crafting does not consume materials; successful crafting grants 12 rounds',()=>{
 const s=fresh();s.inventory.stone=2;s.inventory.scrap=0;const before={...s.inventory};
 assert.equal(craft(s.inventory,'ammo'),false);assert.deepEqual(s.inventory,before);
 s.inventory.scrap=1;assert.equal(craft(s.inventory,'ammo'),true);assert.equal(s.inventory.ammo,48);assert.equal(s.inventory.stone,0);assert.equal(s.inventory.scrap,0);
});
test('unsupported recipe cannot mutate inventory',()=>{const s=fresh();assert.equal(craft(s.inventory,'radio'),false);assert.equal(s.inventory.wood,0);});
test('radio payment is atomic with insufficient supplies',()=>{const inv={scrap:5,stone:3};assert.equal(pay(inv,{scrap:5,stone:4}),false);assert.deepEqual(inv,{scrap:5,stone:3});});
test('save round trip preserves progress',()=>{const s=fresh();s.x=20;s.collected=[0,4];s.killed=[1,2];s.buildings=[{type:'foundation',x:8,z:20,r:0}];s.won=true;assert.deepEqual(loadSave(JSON.stringify(s)),s);});
test('corrupt, incompatible and dead saves are rejected; untrusted values are bounded',()=>{
 assert.equal(loadSave('{'),null);assert.equal(loadSave('null'),null);assert.equal(loadSave('{"version":2}'),null);assert.equal(loadSave(JSON.stringify({...fresh(),health:0})),null);
 const s=loadSave(JSON.stringify({...fresh(),x:1e10,mag:-3,collected:[1,1,-8,'1'],inventory:{wood:-9},buildings:[{type:'script',x:0,z:0}]}));assert.equal(s.x,74);assert.equal(s.mag,0);assert.equal(s.inventory.wood,0);assert.deepEqual(s.collected,[1]);assert.deepEqual(s.buildings,[]);
});
test('ray hits closest face, rejects parallel miss and obstacles behind camera',()=>{const b={x:0,y:1,z:-5,w:2,h:2,d:2};assert.equal(rayBox({x:0,y:1,z:0},{x:0,y:0,z:-1},b),4);assert.equal(rayBox({x:3,y:1,z:0},{x:0,y:0,z:-1},b),null);assert.equal(rayBox({x:0,y:1,z:0},{x:0,y:0,z:1},b),null);});
test('collision radius prevents entering wall',()=>{const boxes=[{x:0,z:0,w:1,d:4}];assert.equal(collides(.7,0,boxes),true);assert.equal(collides(2,0,boxes),false);});
test('scene trace selects the nearest living enemy and respects blocking walls',()=>{
 const origin=vec(0,1,0),dir=vec(0,0,-1);
 const enemies=[{id:0,x:0,z:-3,hp:0},{id:1,x:0,z:-8,hp:90},{id:2,x:0,z:-5,hp:90}];
 assert.deepEqual(traceScene(origin,dir,[],enemies),{distance:4.5,enemyId:2});
 const wall={x:0,y:1,z:-4,w:2,h:2,d:1};
 assert.deepEqual(traceScene(origin,dir,[wall],enemies),{distance:3.5,enemyId:null});
 assert.deepEqual(traceScene(origin,dir,[],enemies,2),{distance:2,enemyId:null});
});
test('deterministic world seed and finite geometry',()=>{const a=rng(),b=rng();for(let i=0;i<50;i++)assert.equal(a(),b());const g=new Geometry();g.box(0,0,0,2,2,2,[1,1,1]);g.cone(0,0,0,2,3,[1,1,1]);assert.equal(g.data.length,57*9);assert.ok(g.data.every(Number.isFinite));assert.ok([...lookAt(vec(0,3,8),vec(0,1,0)),...perspective(16/9)].every(Number.isFinite));});

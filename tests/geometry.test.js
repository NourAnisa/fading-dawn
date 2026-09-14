import test from 'node:test';
import assert from 'node:assert/strict';
import {Geometry} from '../docs/engine.js';

test('ellipsoid triangles face outward and smooth normals follow the surface',()=>{
 const g=new Geometry();g.ellipsoid(2,3,4,.2,.5,.3,[1,1,1]);
 for(let i=0;i<g.data.length;i+=27){
  const a=g.data.slice(i,i+3),b=g.data.slice(i+9,i+12),c=g.data.slice(i+18,i+21);
  const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  assert.ok(n.reduce((s,x,k)=>s+x*((a[k]+b[k]+c[k])/3-[2,3,4][k]),0)>0);
 }
 for(let i=0;i<g.data.length;i+=9){
  const n=g.data.slice(i+3,i+6);assert.ok(Math.abs(Math.hypot(...n)-1)<1e-6);
  const expected=g.data.slice(i,i+3).map((v,k)=>(v-[2,3,4][k])/[.04,.25,.09][k]);
  const length=Math.hypot(...expected);assert.ok(n.every((v,k)=>Math.abs(v-expected[k]/length)<1e-6));
 }
});

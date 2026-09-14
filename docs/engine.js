// Small dependency-free WebGL renderer. Geometry and shaders are original.
export const vec=(x=0,y=0,z=0)=>({x,y,z});
const sub=(a,b)=>vec(a.x-b.x,a.y-b.y,a.z-b.z);
const cross=(a,b)=>vec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const unit=a=>{const l=Math.hypot(a.x,a.y,a.z)||1;return vec(a.x/l,a.y/l,a.z/l);};
export function lookAt(eye,target){const z=unit(sub(eye,target)),x=unit(cross(vec(0,1,0),z)),y=cross(z,x);return new Float32Array([x.x,y.x,z.x,0,x.y,y.y,z.y,0,x.z,y.z,z.z,0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export function perspective(aspect){const f=1/Math.tan(Math.PI/6),n=.12,far=340;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0]);}
export const color=hex=>[parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255];
const sphereMeshes=new Map();
export class Geometry{
 constructor(){this.data=[];}
 ellipsoid(x,y,z,rx,ry,rz,col,sides=12,rings=8){
  if(rx<=0||ry<=0||rz<=0)throw Error('Ellipsoid radii must be positive');
  // Unit mesh is shared by every limb; inverse radii give smooth outward normals.
  const key=`${sides}/${rings}`;
  let mesh=sphereMeshes.get(key);
  if(!mesh){
   mesh=[];
   const point=(u,v)=>[Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)];
   for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){
    const u=i/sides*Math.PI*2,U=(i+1)/sides*Math.PI*2,v=j/rings*Math.PI,V=(j+1)/rings*Math.PI;
    const a=point(u,v),b=point(U,v),c=point(U,V),d=point(u,V);
    if(j>0)mesh.push(a,b,c);
    if(j<rings-1)mesh.push(a,c,d);
   }
   sphereMeshes.set(key,mesh);
  }
  for(const [px,py,pz] of mesh){const n=unit(vec(px/rx,py/ry,pz/rz));this.data.push(x+rx*px,y+ry*py,z+rz*pz,n.x,n.y,n.z,...col);}

 }
 beam(a,b,width,col){
  const direction=unit(sub(b,a));
  const side=unit(cross(direction,Math.abs(direction.y)>.95?vec(1,0,0):vec(0,1,0)));
  const up=unit(cross(direction,side));
  for(const axis of [side,up]){
   const point=(p,sign)=>vec(p.x+axis.x*width*sign,p.y+axis.y*width*sign,p.z+axis.z*width*sign);
   this.tri(point(a,-1),point(a,1),point(b,1),col);
   this.tri(point(a,-1),point(b,1),point(b,-1),col);
  }
 }
 tri(a,b,c,col){const n=unit(cross(sub(b,a),sub(c,a)));for(const p of [a,b,c])this.data.push(p.x,p.y,p.z,n.x,n.y,n.z,...col);}
 box(x,y,z,w,h,d,col,r=0){const s=Math.sin(r),c=Math.cos(r);const p=(a,b,e)=>vec(x+a*c-e*s,y+b,z+a*s+e*c);const v=[p(-w/2,-h/2,-d/2),p(w/2,-h/2,-d/2),p(w/2,h/2,-d/2),p(-w/2,h/2,-d/2),p(-w/2,-h/2,d/2),p(w/2,-h/2,d/2),p(w/2,h/2,d/2),p(-w/2,h/2,d/2)];for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){this.tri(v[f[0]],v[f[1]],v[f[2]],col);this.tri(v[f[0]],v[f[2]],v[f[3]],col);}}
 cone(x,y,z,r,h,col,sides=7){for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;this.tri(vec(x+Math.cos(a)*r,y,z+Math.sin(a)*r),vec(x,y+h,z),vec(x+Math.cos(b)*r,y,z+Math.sin(b)*r),col);}}
}
export class Renderer{
 constructor(canvas){this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL tidak tersedia. Aktifkan akselerasi grafis atau gunakan browser lain.');const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,`attribute vec3 aPosition,aNormal,aColor;uniform mat4 uView,uProjection;varying vec3 vColor;varying float vDistance;uniform float uLight;void main(){vec4 view=uView*vec4(aPosition,1.0);gl_Position=uProjection*view;float sun=max(dot(normalize(aNormal),normalize(vec3(-0.5,0.9,0.3))),0.0);vColor=aColor*(0.40+sun*0.68)*uLight;vDistance=length(view.xyz);}`));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 vColor;varying float vDistance;uniform vec3 uFog;void main(){float fog=smoothstep(45.0,220.0,vDistance);gl_FragColor=vec4(mix(vColor,uFog,fog),1.0);}`));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);this.uniform={};for(const u of ['uView','uProjection','uFog','uLight'])this.uniform[u]=gl.getUniformLocation(this.program,u);this.attributes=['aPosition','aNormal','aColor'].map(n=>gl.getAttribLocation(this.program,n));gl.enable(gl.DEPTH_TEST);this.staticBuffer=gl.createBuffer();this.dynamicBuffer=gl.createBuffer();this.staticCount=0;}
 upload(geometry){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry.data),gl.STATIC_DRAW);this.staticCount=geometry.data.length/9;}
 draw(buffer,count){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(let i=0;i<3;i++){gl.enableVertexAttribArray(this.attributes[i]);gl.vertexAttribPointer(this.attributes[i],3,gl.FLOAT,false,36,i*12);}gl.drawArrays(gl.TRIANGLES,0,count);}
 render(eye,target,geometry,light=1){const gl=this.gl,c=this.canvas;const ratio=Math.min(devicePixelRatio||1,1.5),w=Math.round(c.clientWidth*ratio),h=Math.round(c.clientHeight*ratio);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);const fog=[.61*light,.73*light,.81*light];gl.clearColor(...fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(this.uniform.uView,false,lookAt(eye,target));gl.uniformMatrix4fv(this.uniform.uProjection,false,perspective(w/Math.max(h,1)));gl.uniform3fv(this.uniform.uFog,fog);gl.uniform1f(this.uniform.uLight,light);this.draw(this.staticBuffer,this.staticCount);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry.data),gl.DYNAMIC_DRAW);this.draw(this.dynamicBuffer,geometry.data.length/9);}
}

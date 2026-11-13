// Stereographic projection about the nadir. With camera height a and horizontal
// range d, the ground maps to r=R*d/(hypot(d,a)+a); the horizon is the circle R.
'use strict';
const {PAL, PROPS, MISC} = require('./sprites');
const rgb = name => PAL[name].slice(1).match(/../g).map(n => parseInt(n,16));
const sky=rgb('sky'), ground=rgb('ground'), line=rgb('g');
function planet(S, c, persons, props, k, W, H) {
  const [start, end] = S.planetRadius || [1.28, 0.4];
  const radius = Math.min(W,H) * (start + (end-start)*k);
  const co = Math.cos(c.yaw), si = Math.sin(c.yaw);
  function point(x,y,z) {
    const dx=x-c.x, dz=z-c.z, a=c.y-y, d=Math.hypot(dx,dz);
    const scale=radius / Math.max(0.0001,Math.hypot(d,a)+a);
    return [W/2+(co*dx-si*dz)*scale,H/2-(si*dx+co*dz)*scale,scale];
  }
  const items = [...props,...persons.map(p=>({person:true,x:p.x,z:p.z,h:p.ht,pal:p.pal}))].map(o=>{
    const def=PROPS[o.s] || PROPS.box, rows=o.person ? MISC.marker.front : (def.rows || PROPS.carS.rows);
    const h=o.h || def.h, y=o.y || 0, foot=point(o.x,y,o.z), tip=point(o.x,y+h,o.z);
    const dx=tip[0]-foot[0], dy=tip[1]-foot[1], sw=(o.wd || (o.person ? 0.62 : def.wd || h*rows[0].length/rows.length))*foot[2];
    const hh=Math.max(sw*0.7,Math.hypot(dx,dy)), rot=(dx||dy) ? Math.atan2(dx,-dy) : 0;
    return {rows,w:sw,h:hh,x:foot[0]+Math.sin(rot)*hh/2-sw/2,y:foot[1]-Math.cos(rot)*hh/2-hh/2,z:Math.hypot(o.x-c.x,o.z-c.z),rot,pal:o.pal};
  }).sort((a,b)=>b.z-a.z);
  return {cam:c,roll:0,grid:[],items,over:[],mb:[0,0],planet:{radius,c,co,si,grid:S.grid!==0}};
}
function groundPixels(px,W,H,{radius,c,co,si,grid}) {
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const nx=(x+.5-W/2)/radius, nz=(H/2-y-.5)/radius, r2=nx*nx+nz*nz;
    let color=sky;
    if(r2<1){
      color=ground;
      if(grid && r2<.91) {
        const scale=2*c.y/(1-r2), gx=c.x+(co*nx+si*nz)*scale, gz=c.z+(-si*nx+co*nz)*scale;
        const dist=Math.min(Math.abs(gx-2*Math.round(gx/2)),Math.abs(gz-2*Math.round(gz/2)));
        const footprint=scale/radius/(1-r2);
        if(footprint<.38 && dist<footprint*.55) color=line;
      }
    }
    const i=(y*W+x)*3; px[i]=color[0]; px[i+1]=color[1]; px[i+2]=color[2];
  }
}
module.exports={planet,groundPixels};

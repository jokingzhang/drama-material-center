import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {expand, moves} = require('../lib/jobs');
const {frame, actionTime} = require('../lib/engine');
const {render} = require('../lib/raster');
const station = require('../examples/station-24.json');

test('all 24 named moves accept the same editable cast/set and produce image data', () => {
  assert.equal(new Set(moves.map(m => m[0])).size, 24);
  for (const [i, [id,zh,en]] of moves.entries()) {
    const spec = station.shots[i];
    assert.equal(spec.move, id);
    const s = expand(spec, station);
    assert.deepEqual(expand({...spec, move:zh}, station), s);
    assert.deepEqual(expand({...spec, move:en}, station), s);
    assert.ok(s.p.some(p=>p.name), id);
    for (const t of [0, s.dur/2, s.dur-1/24]) {
      const pixels = render(frame(s,t,128,72),128,72);
      assert.ok(new Set(pixels).size>10,id);
    }
  }
  assert.throws(()=>expand({move:'摇镜',p:[{ref:'missing'}]},station),/缺少/);
});

test('rapid moves retain their motion window after shortening the shot', () => {
  for (const id of ['M12','M21']) {
    const s = expand({move:id,dur:1,w:0});
    const start=frame(s,0,200,120).cam, end=frame(s,.9,200,120).cam;
    assert.ok(s.t[1] < 1);
    assert.notDeepEqual(start,end);
  }
});

test('dolly zoom holds the actor scale while the bench changes angular size', () => {
  const s=expand(station.shots[18],station);
  const a=frame(s,0,400,224).cam, b=frame(s,2.95,400,224).cam;
  const scale=(cam,z)=>cam.f/(z-cam.z);
  assert.ok(Math.abs(scale(a,8)/scale(b,8)-1)<.01);
  assert.ok(Math.abs(scale(a,9.5)/scale(b,9.5)-1)>.15);
});

test('freeze pauses falling prop time as camera moves, then resumes without jumping', () => {
  const s=expand(station.shots[16],station);
  assert.equal(actionTime(s,.2),.2);
  assert.equal(actionTime(s,1.9),actionTime(s,.5));
  assert.ok(Math.abs(actionTime(s,2.46)-.58)<1e-8);
  assert.notDeepEqual(frame(s,.5,256,144).cam, frame(s,1.9,256,144).cam);
});

test('tiny planet closes its horizon and retains both character identities', () => {
  const s=expand(station.shots[14],station);
  const first=frame(s,0,320,180), last=frame(s,2.95,320,180);
  assert.ok(first.planet.radius>90 && last.planet.radius<90);
  for (const color of ['#3e6db5','#b0613f']) assert.ok(last.items.some(item=>item.pal?.R===color));
  const pix=render(last,320,180);
  assert.deepEqual([...pix.subarray(0,3)], [232,228,220]); // outside the planet: sky
});

test('clean proxy bodies remain rigid while traveling; POV has no hand overlay', () => {
  const s=expand({move:'M10',p:[{ref:'qing',to:[2,8]}],w:0},station);
  const actor=t=>frame(s,t,320,180).items.find(it=>it.pal?.R==='#3e6db5');
  assert.deepEqual(actor(1).rows, actor(1.25).rows);
  assert.throws(()=>expand({p:[{act:'wave'}]}),/整体走位/);
  assert.deepEqual(frame(expand({preset:'F13'}),1,160,90).over,[]);
});

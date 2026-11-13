'use strict';
const moves = require('../camera-24.json');
const presets = [...require('../presets.json'), ...require('../moves.json').map(p => ({cat: '项目运镜', ...p}))];
const byId = new Map(presets.map(p => [p.id, p]));

// Preset motion windows are authored in seconds, normally for a 6 s shot.
// Scale only inherited times; overrides supplied by the director are already in final seconds.
function retime(value, factor) {
  if (Array.isArray(value)) return value.map(v => retime(v, factor));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([k,v]) => {
    if (k === 't' || k === 'freezeWindow') return [k, Array.isArray(v) ? v.map(n => n * factor) : v * factor];
    if (k === 'shakeAt' || k === 'freezeAt') return [k, v * factor];
    return [k, retime(v,factor)];
  }));
}
function expand(s, scene = {}) {
  const {preset: explicit, move, ...overrides} = s;
  const entry = move && moves.find(([id,zh,en]) => move === id || move === zh || move.toLowerCase() === en.toLowerCase());
  if (move && (!entry || explicit)) throw new Error('move 须为 24 项中的编号或名称，且与 preset 二选一：' + move);
  const preset = explicit || entry?.[3];
  if (preset && !byId.has(preset)) throw new Error('未知预设：' + preset);
  const template = byId.get(preset)?.spec || {};
  const authored = template.dur ?? 6, dur = overrides.dur ?? authored;
  if (!Number.isFinite(dur) || dur <= 0) throw new Error('dur 必须是正秒数');
  const shot = {...retime(template, dur / authored), ...overrides, dur};
  for (const [key, dict] of [['p','cast'],['add','set']]) {
    if (shot[key]) shot[key] = shot[key].map(item => {
      if (!item.ref) return item;
      if (!scene[dict] || !Object.hasOwn(scene[dict],item.ref)) throw new Error('场景中缺少 ' + item.ref);
      return {...scene[dict][item.ref],...item};
    });
  }
  function check(part) {
    if (part.freezeWindow && !(Array.isArray(part.freezeWindow) && part.freezeWindow.length === 2 && part.freezeWindow[0] >= 0 && part.freezeWindow[1] > part.freezeWindow[0] && part.freezeWindow[1] <= dur)) throw new Error('冻结区间须在镜内');
    for (const p of part.p ?? []) {
      if ('hold' in p || 'act' in p) throw new Error('预演人物仅支持整体走位；去掉 act/hold，精确接触请转 Blender。');
    }
    if (part.o && part.p?.length === 0 && !part.pivot) throw new Error('道具环绕需要 pivot:[x,z]');
    for (const cut of part.cuts ?? []) check(cut);
  }
  check(shot);
  return shot;
}
module.exports = {moves, presets, byId, expand};

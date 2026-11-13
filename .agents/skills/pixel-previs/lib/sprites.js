/* 固定像素小图：无四肢身份标记与静态道具。全部预先画好，镜头只移动缩放它们。
   每个字符是一种颜色（见 PAL），'.' 透明。 */
'use strict';
const PAL = { sky: '#e8e4dc', ground: '#d6d0c5', g: '#bab2a5', k: '#2b2723', H: '#2e2925', S: '#e2b996', R: '#3e6db5', B: '#33394a', T: '#c4bdb1', F: '#aaa397', D: '#928b80', m: '#c3bcb0', s: '#c6bfb3',
  W: '#a88a6a', w: '#7e6650', G: '#8ea37f', E: '#71876a', C: '#8d98a3', c: '#6f7882', Q: '#cdd5d6', M: '#9a9da0', Y: '#d8c48e', P: '#4a4d55', X: '#b9b2a6' };
const rep = (s, n) => Array(n).fill(s);

const s = str => str.trim().split(/\s+/);
const PROPS = {
  box: { h: 0.9, rows: ['kkkkkkkkkk'].concat(rep('kTTTTTTTTk', 2), ['kkkkkkkkkk'], rep('kFFFFFFFDk', 4), ['kkkkkkkkkk']) },
  pillar: { h: 5, rows: ['kkkkkk'].concat(rep('kFFFDk', 38), ['kkkkkk']) },
  mark: { h: 0.06, rows: ['mmm'], wd: 0.3 },
  table: { h: 0.75, rows: ['kkkkkkkkkkkkkkkkkk', 'kWWWWWWWWWWWWWWWWk', 'kkkkkkkkkkkkkkkkkk'].concat(rep('.kwk..........kwk.', 4), ['.kkk..........kkk.']) },
  chair: { h: 0.9, rows: s('.kkkkkk. .kWWWWk. .kWWWWk. .kkkkkk. kWWWWWWk kkkkkkkk kwk..kwk kwk..kwk kkk..kkk') },
  bench: { h: 0.5, rows: ['kkkkkkkkkkkkkkkkkkkk', 'kWWWWWWWWWWWWWWWWWWk', 'kkkkkkkkkkkkkkkkkkkk', '.kMk............kMk.', '.kMk............kMk.', '.kkk............kkk.'] },
  tree: { h: 4, rows: s(`....kkkkkk.... ..kkGGGGGGkk.. .kGGGGGGGGGGk. kGGGGEGGGGGGGk kGGGGGGGGEGGGk kGGEGGGGGGGGGk kGGGGGGGGGGEGk .kGGGGGEGGGGk. ..kkGGGGGGkk.. ....kkwwkk....`).concat(rep('.....kwwk.....', 5), ['....kkkkkk....']) },
  lamp: { h: 3.5, rows: ['.kkkkk.', 'kMMMMMk', '.kYYYk.', '..kkk..'].concat(rep('...kMk.'.padEnd(7, '.'), 22), ['..kkkk.']) },
  door: { h: 2.4, rows: ['kkkkkkkkkk', 'kFFFFFFFFk', 'kFkkkkkkFk'].concat(rep('kFkWWWWkFk', 6), ['kFkWWWkkFk'.replace('kkFk', 'YkFk')], rep('kFkWWWWkFk', 5), ['kkkkkkkkkk']) },
  wall: { h: 2.5, tile: 1, rows: ['kkkkkkkkkkkkkkkk'].concat(rep('kFFFFFFFFFFFFFDk', 3), ['kDDDDDDDDDDDDDDk'], rep('kFFFFFFFFFFFFFDk', 3), ['kDDDDDDDDDDDDDDk'], rep('kFFFFFFFFFFFFFDk', 3), ['kkkkkkkkkkkkkkkk']) },
  screen: { h: 0.55, rows: ['kkkkkkkkkkkk', 'kPPPPPPPPPPk', 'kPQPPPPPPPPk', 'kPPPPPPPPPPk', 'kPPPPPPPPPPk', 'kkkkkkkkkkkk', '.....kk.....', '...kkkkkk...'] },
  bag: { h: 0.45, rows: s('...kkkk... ..k....k.. kkkkkkkkkk kwwwwwwwwk kwwwwwwwwk kwwwYwwwwk kwwwwwwwwk kkkkkkkkkk') },
  rock: { h: 0.6, rows: s('...kkkkk... .kkXXXXXkk. kXXXXXXXDXk kXXDXXXXXXk kXXXXXXXXXk kkkkkkkkkkk') },
  car: { h: 1.5, views: { side: 'carS', front: 'carF', back: 'carF' } },
  carS: { h: 1.5, rows: ['........kkkkkkkkkk..........', '.......kCQQQkQQQQQk.........', '......kCQQQQkQQQQQQk........', '.....kCCQQQQkQQQQQQQk.......', 'kkkkkCCCCCCCCCCCCCCCCkkkkkk.', 'kCCCCCCCCCCCCCCCCCCCCCCCCCYk', 'kCCCCCCCCCcCCCCCCCCCCCCCCCCk', 'kcccccccccccccccccccccccccck', 'kkkkkkkkkkkkkkkkkkkkkkkkkkkk', '...kkkkk...........kkkkk....', '....kkk.............kkk.....'] },
  carF: { h: 1.5, rows: s('...kkkkkkkk... ..kQQQQQQQQk.. .kQQQQQQQQQQk. kkkkkkkkkkkkkk kCCCCCCCCCCCCk kYYCCCCCCCCYYk kCCCCCCCCCCCCk kcccccccccccck kkkkkkkkkkkkkk kkk........kkk kkk........kkk') }
};
// 手持物：grip 是手握的位置（相对小图宽高的比例）
// R 是身份色，B 是同一实体的背光边；小浅色缺口是朝向记号。
const markerRows = stripe => ['.kkkkkk.', 'kRRRRRBk', stripe, ...rep('kRRRRRBk', 9), '.kkkkkk.'];
const MISC = {
  marker: {
    front: markerRows('kRRYRRBk'), side: markerRows('kRRRRBYk'), back: markerRows('kRRRRRBk')
  },
  markerTop: ['.kkkk.', 'kRRRBk', 'kRRRBk', 'kRYYBk', '.kkkk.'],
  btop: ['kkkkkkkkkk'].concat(rep('kTTTTTTTTk', 8), ['kkkkkkkkkk']),
  shadow: ['.ssssss.', 'ssssssss', '.ssssss.']
};
module.exports = { PAL, PROPS, MISC };

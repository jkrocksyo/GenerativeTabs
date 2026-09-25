'use strict';

// Shared colour palettes for the Interactive scenes (Point Sphere, Liquid Orb,
// Lens Illusion). Each interactive background exposes the same seven named
// presets in the picker; the swatch gradients here are the single source of
// truth so the pickers look identical across the category.
//
//   bg     — scene background fill
//   dot    — primary particle / dot colour (gradient start)
//   accent — secondary colour the dots grade toward (gradient end)
//   swatch — the two-stop gradient shown on the picker button
//
// The Liquid Orb keeps its own richer per-preset shader tuning internally; it
// only borrows the names + swatch colours from here for a consistent picker.
const INTERACTIVE_PALETTES = [
  { name: 'Aurora',   bg: '#070A18', dot: '#5CB8FF', accent: '#E24DD0', swatch: ['#33B5FF', '#E24DD0'] },
  { name: 'Ember',    bg: '#160806', dot: '#FF9A4D', accent: '#FF2D55', swatch: ['#FF7A18', '#FF2D55'] },
  { name: 'Toxic',    bg: '#04120C', dot: '#7BFF6A', accent: '#00FFC8', swatch: ['#57FF3C', '#00FFC8'] },
  { name: 'Ice',      bg: '#0A1424', dot: '#BFEFFF', accent: '#6FD2FF', swatch: ['#6FD2FF', '#BFEFFF'] },
  { name: 'Plasma',   bg: '#10061C', dot: '#C79BFF', accent: '#FF3DBE', swatch: ['#9B5CFF', '#FF3DBE'] },
  { name: 'Ghost',    bg: '#0A0A0D', dot: '#C2CBE6', accent: '#8893B5', swatch: ['#AEB8D8', '#6E7799'] },
  { name: 'Daylight', bg: '#EEF2F8', dot: '#2D6CFF', accent: '#B43CF0', swatch: ['#3A82FF', '#A84DFF'] },
];

// Build a full palette from a single custom hex colour so the picker can offer
// "any colour": dot = the colour, accent = a lighter tint, bg = a near-black
// tint. Any scene that resolves colours through interactivePalette() gets custom
// colours for free.
function _ipRgb(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128];
}
function _ipHex(rgb) {
  return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function _ipMix(rgb, target, t) { return rgb.map((v, i) => v + (target[i] - v) * t); }
function customInteractivePalette(hex) {
  const dot = _ipRgb(hex);
  const accent = _ipMix(dot, [255, 255, 255], 0.42);
  const bg = _ipMix(dot, [7, 8, 14], 0.90);
  return { name: hex, bg: _ipHex(bg), dot: _ipHex(dot), accent: _ipHex(accent),
           swatch: [_ipHex(dot), _ipHex(accent)] };
}

function interactivePalette(name) {
  if (typeof name === 'string' && name[0] === '#') return customInteractivePalette(name);
  return INTERACTIVE_PALETTES.find(p => p.name === name) || INTERACTIVE_PALETTES[0];
}

window.INTERACTIVE_PALETTES = INTERACTIVE_PALETTES;
window.interactivePalette = interactivePalette;

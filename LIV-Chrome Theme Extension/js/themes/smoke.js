/* ═══════════════════════════════════════════════════════════════════
   LiV — SMOKE
   Original CSS scene (feTurbulence sprites, no JS/canvas/assets).

   LiV themes normally render to a <canvas>, but Smoke is pure HTML+CSS:
   26 heavily-overlapped soft sprites, each a shared inline-SVG noise
   texture masked to a soft puff, drifting and spinning at unrelated
   rates and screen-blended so overlaps brighten. So this "theme" does
   two different things depending on where it is mounted:

     • Live background (canvas is inside #canvas-container) — inject the
       real scoped CSS smoke DOM behind the (hidden) canvas. All motion
       is CSS; draw() is a no-op.
     • Picker thumbnail / settings preview (any other canvas, incl. the
       offscreen snapshot canvas) — paint a static teal approximation on
       the 2D canvas, because those paths capture the canvas, not the DOM.

   Everything is scoped under the .liv-smoke root so nothing leaks into
   the rest of the app. Colour follows the shared Interactive palette
   (--smoke = the palette's dot colour); speed/density follow the engine.
   Only transform/opacity animate — no filter:blur() anywhere. See the
   integration notes that shipped with the scene before changing this.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const STYLE_ID = 'liv-smoke-style';
  const DEFAULT_SMOKE = '125, 215, 210';  // teal, if no palette resolves
  const PUSH_RADIUS = 0.34;   // pointer influence radius, fraction of the shorter viewport side
  const PUSH_STEP   = 0.004;  // per-frame drift added while the cursor is near, fraction of it
  const PUSH_MAX    = 0.12;   // cap on accumulated displacement, fraction of it
  const PUSH_EASE   = 0.06;   // per-frame ease of the actual offset toward the target

  // Three shared noise textures: coarse (mass), mid (body), fine (filaments).
  const MASK_A = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Cdefs%3E%3Cfilter id='f' x='0' y='0' width='512' height='512' filterUnits='userSpaceOnUse'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.010' numOctaves='6' seed='11'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 -0.22'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1.6' exponent='1.1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3CradialGradient id='g'%3E%3Cstop offset='0' stop-color='%23fff' stop-opacity='1'/%3E%3Cstop offset='0.45' stop-color='%23fff' stop-opacity='0.9'/%3E%3Cstop offset='0.78' stop-color='%23fff' stop-opacity='0.35'/%3E%3Cstop offset='1' stop-color='%23fff' stop-opacity='0'/%3E%3C/radialGradient%3E%3Cmask id='m'%3E%3Crect width='512' height='512' fill='url(%23g)'/%3E%3C/mask%3E%3C/defs%3E%3Cg mask='url(%23m)'%3E%3Crect width='512' height='512' filter='url(%23f)'/%3E%3C/g%3E%3C/svg%3E\")";
  const MASK_B = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Cdefs%3E%3Cfilter id='f' x='0' y='0' width='512' height='512' filterUnits='userSpaceOnUse'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.018' numOctaves='6' seed='37'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 -0.28'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1.8' exponent='1.3'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3CradialGradient id='g'%3E%3Cstop offset='0' stop-color='%23fff' stop-opacity='1'/%3E%3Cstop offset='0.45' stop-color='%23fff' stop-opacity='0.9'/%3E%3Cstop offset='0.78' stop-color='%23fff' stop-opacity='0.35'/%3E%3Cstop offset='1' stop-color='%23fff' stop-opacity='0'/%3E%3C/radialGradient%3E%3Cmask id='m'%3E%3Crect width='512' height='512' fill='url(%23g)'/%3E%3C/mask%3E%3C/defs%3E%3Cg mask='url(%23m)'%3E%3Crect width='512' height='512' filter='url(%23f)'/%3E%3C/g%3E%3C/svg%3E\")";
  const MASK_C = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Cdefs%3E%3Cfilter id='f' x='0' y='0' width='512' height='512' filterUnits='userSpaceOnUse'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.030' numOctaves='5' seed='73'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 -0.34'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='2.0' exponent='1.6'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3CradialGradient id='g'%3E%3Cstop offset='0' stop-color='%23fff' stop-opacity='1'/%3E%3Cstop offset='0.45' stop-color='%23fff' stop-opacity='0.9'/%3E%3Cstop offset='0.78' stop-color='%23fff' stop-opacity='0.35'/%3E%3Cstop offset='1' stop-color='%23fff' stop-opacity='0'/%3E%3C/radialGradient%3E%3Cmask id='m'%3E%3Crect width='512' height='512' fill='url(%23g)'/%3E%3C/mask%3E%3C/defs%3E%3Cg mask='url(%23m)'%3E%3Crect width='512' height='512' filter='url(%23f)'/%3E%3C/g%3E%3C/svg%3E\")";

  const CSS = `
.liv-smoke { position:absolute; inset:0; overflow:hidden;
  --smoke:${DEFAULT_SMOKE}; --speed:1; --density:1; }
.liv-smoke .stage { position:absolute; inset:0; overflow:hidden; opacity:var(--density);
  background: radial-gradient(ellipse 80% 70% at 50% 52%, #0a2024 0%, #050a0c 74%), #050a0c; }
.liv-smoke .puff { position:absolute; left:var(--x); top:var(--y); width:var(--w); height:var(--w);
  will-change:transform;
  animation: livSmokeDrift calc(var(--dd) * var(--speed)) ease-in-out infinite alternate;
  animation-delay: var(--delay); }
.liv-smoke .puff > i { display:block; width:100%; height:100%;
  background-color: rgb(var(--smoke)); opacity:var(--o); mix-blend-mode:screen; will-change:transform;
  -webkit-mask-size:100% 100%; mask-size:100% 100%;
  -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;
  animation: livSmokeSpin calc(var(--sd) * var(--speed)) linear infinite;
  animation-delay: calc(var(--sd) * -0.37); }
@keyframes livSmokeSpin {
  from { transform: rotate(0deg)                    scale(var(--s)); }
  50%  { transform: rotate(calc(180deg * var(--r))) scale(calc(var(--s) * 1.10)); }
  to   { transform: rotate(calc(360deg * var(--r))) scale(var(--s)); } }
/* --pushx/--pushy are the per-puff pointer displacement (set from JS). They're
   folded into the drift keyframes so the cursor push composes with the drift on
   the same element — no extra transformed wrapper (which would isolate the
   puffs' screen blending and flatten the smoke). */
@keyframes livSmokeDrift {
  from { transform: translate(calc(-50% + var(--dx1) + var(--pushx, 0px)),
                              calc(-50% + var(--dy1) + var(--pushy, 0px))); }
  to   { transform: translate(calc(-50% + var(--dx2) + var(--pushx, 0px)),
                              calc(-50% + var(--dy2) + var(--pushy, 0px))); } }
.liv-smoke .a { mask-image:${MASK_A}; -webkit-mask-image:${MASK_A}; }
.liv-smoke .b { mask-image:${MASK_B}; -webkit-mask-image:${MASK_B}; }
.liv-smoke .c { mask-image:${MASK_C}; -webkit-mask-image:${MASK_C}; }
.liv-smoke .vignette { position:absolute; inset:0; pointer-events:none;
  background: radial-gradient(ellipse 74% 70% at 50% 50%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.70) 100%); }
.liv-smoke.paused .puff, .liv-smoke.paused .puff > i { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .liv-smoke .puff, .liv-smoke .puff > i { animation: none; } }
`;

  // 26 sprites: heavy overlap, unrelated rates in both directions.
  const PUFFS = `
    <div class="puff" style="--x:34.5%; --y:20.7%; --w:79vmin; --dd:42s; --delay:-2s; --dx1:-0.8vmin; --dy1:-5.2vmin; --dx2:-4.9vmin; --dy2:-0.9vmin;"><i class="a" style="--o:0.17; --s:1.03; --r:1; --sd:77s;"></i></div>
    <div class="puff" style="--x:78.8%; --y:18.4%; --w:58vmin; --dd:57s; --delay:-3s; --dx1:4.3vmin; --dy1:-2.5vmin; --dx2:-4.3vmin; --dy2:-4.6vmin;"><i class="b" style="--o:0.27; --s:1.11; --r:-1; --sd:118s;"></i></div>
    <div class="puff" style="--x:33.1%; --y:76.6%; --w:56vmin; --dd:28s; --delay:-4s; --dx1:-3.5vmin; --dy1:2.2vmin; --dx2:-0.9vmin; --dy2:-2.2vmin;"><i class="c" style="--o:0.26; --s:1.05; --r:1; --sd:136s;"></i></div>
    <div class="puff" style="--x:57.5%; --y:46.1%; --w:63vmin; --dd:43s; --delay:-53s; --dx1:2.8vmin; --dy1:-2.5vmin; --dx2:5.8vmin; --dy2:-4.6vmin;"><i class="a" style="--o:0.30; --s:1.06; --r:1; --sd:139s;"></i></div>
    <div class="puff" style="--x:42.8%; --y:71.6%; --w:56vmin; --dd:44s; --delay:-53s; --dx1:-2.2vmin; --dy1:2.3vmin; --dx2:1.1vmin; --dy2:1.0vmin;"><i class="b" style="--o:0.25; --s:0.93; --r:-1; --sd:162s;"></i></div>
    <div class="puff" style="--x:46.1%; --y:78.6%; --w:98vmin; --dd:47s; --delay:-60s; --dx1:3.9vmin; --dy1:-2.6vmin; --dx2:-1.4vmin; --dy2:2.0vmin;"><i class="c" style="--o:0.25; --s:1.05; --r:1; --sd:154s;"></i></div>
    <div class="puff" style="--x:8.0%; --y:46.8%; --w:58vmin; --dd:34s; --delay:-23s; --dx1:4.5vmin; --dy1:-5.0vmin; --dx2:-0.6vmin; --dy2:0.6vmin;"><i class="a" style="--o:0.18; --s:0.93; --r:-1; --sd:86s;"></i></div>
    <div class="puff" style="--x:83.7%; --y:76.8%; --w:95vmin; --dd:57s; --delay:-9s; --dx1:-3.9vmin; --dy1:-3.2vmin; --dx2:-3.2vmin; --dy2:-0.2vmin;"><i class="b" style="--o:0.21; --s:1.00; --r:1; --sd:176s;"></i></div>
    <div class="puff" style="--x:57.8%; --y:30.1%; --w:50vmin; --dd:48s; --delay:-31s; --dx1:1.4vmin; --dy1:2.1vmin; --dx2:-5.4vmin; --dy2:4.8vmin;"><i class="c" style="--o:0.24; --s:0.99; --r:-1; --sd:184s;"></i></div>
    <div class="puff" style="--x:74.6%; --y:81.5%; --w:94vmin; --dd:28s; --delay:-4s; --dx1:-3.5vmin; --dy1:-4.1vmin; --dx2:-1.9vmin; --dy2:-5.4vmin;"><i class="a" style="--o:0.23; --s:1.00; --r:1; --sd:146s;"></i></div>
    <div class="puff" style="--x:6.0%; --y:20.7%; --w:56vmin; --dd:31s; --delay:-15s; --dx1:-1.8vmin; --dy1:-1.6vmin; --dx2:-4.5vmin; --dy2:4.2vmin;"><i class="b" style="--o:0.23; --s:0.93; --r:-1; --sd:144s;"></i></div>
    <div class="puff" style="--x:93.4%; --y:47.1%; --w:78vmin; --dd:53s; --delay:-10s; --dx1:-5.7vmin; --dy1:5.4vmin; --dx2:0.3vmin; --dy2:-4.2vmin;"><i class="c" style="--o:0.18; --s:0.94; --r:1; --sd:102s;"></i></div>
    <div class="puff" style="--x:53.8%; --y:10.3%; --w:81vmin; --dd:38s; --delay:-10s; --dx1:3.3vmin; --dy1:0.4vmin; --dx2:3.3vmin; --dy2:-2.0vmin;"><i class="a" style="--o:0.34; --s:1.09; --r:-1; --sd:101s;"></i></div>
    <div class="puff" style="--x:25.6%; --y:76.2%; --w:108vmin; --dd:33s; --delay:-31s; --dx1:-1.7vmin; --dy1:-5.7vmin; --dx2:-5.7vmin; --dy2:-2.6vmin;"><i class="b" style="--o:0.31; --s:1.08; --r:-1; --sd:159s;"></i></div>
    <div class="puff" style="--x:28.8%; --y:66.2%; --w:107vmin; --dd:38s; --delay:-13s; --dx1:-3.3vmin; --dy1:-3.6vmin; --dx2:-3.5vmin; --dy2:1.5vmin;"><i class="c" style="--o:0.24; --s:1.11; --r:-1; --sd:185s;"></i></div>
    <div class="puff" style="--x:85.2%; --y:78.6%; --w:80vmin; --dd:55s; --delay:-47s; --dx1:3.0vmin; --dy1:-0.3vmin; --dx2:-3.9vmin; --dy2:3.5vmin;"><i class="a" style="--o:0.28; --s:1.08; --r:1; --sd:149s;"></i></div>
    <div class="puff" style="--x:35.3%; --y:75.3%; --w:110vmin; --dd:31s; --delay:-8s; --dx1:-4.2vmin; --dy1:4.9vmin; --dx2:3.7vmin; --dy2:-4.2vmin;"><i class="b" style="--o:0.23; --s:1.00; --r:-1; --sd:157s;"></i></div>
    <div class="puff" style="--x:78.7%; --y:90.3%; --w:92vmin; --dd:57s; --delay:-39s; --dx1:0.3vmin; --dy1:5.2vmin; --dx2:-0.8vmin; --dy2:4.5vmin;"><i class="c" style="--o:0.22; --s:1.03; --r:1; --sd:72s;"></i></div>
    <div class="puff" style="--x:78.7%; --y:25.7%; --w:69vmin; --dd:39s; --delay:-8s; --dx1:4.9vmin; --dy1:-1.8vmin; --dx2:-0.5vmin; --dy2:1.0vmin;"><i class="a" style="--o:0.21; --s:0.97; --r:-1; --sd:101s;"></i></div>
    <div class="puff" style="--x:85.6%; --y:43.3%; --w:109vmin; --dd:40s; --delay:-11s; --dx1:-6.0vmin; --dy1:3.6vmin; --dx2:-3.9vmin; --dy2:-0.3vmin;"><i class="b" style="--o:0.25; --s:1.03; --r:-1; --sd:72s;"></i></div>
    <div class="puff" style="--x:69.8%; --y:54.7%; --w:75vmin; --dd:44s; --delay:-15s; --dx1:-2.7vmin; --dy1:3.3vmin; --dx2:0.1vmin; --dy2:0.7vmin;"><i class="c" style="--o:0.25; --s:1.03; --r:-1; --sd:83s;"></i></div>
    <div class="puff" style="--x:72.9%; --y:84.6%; --w:82vmin; --dd:40s; --delay:-32s; --dx1:-0.3vmin; --dy1:5.3vmin; --dx2:2.4vmin; --dy2:4.5vmin;"><i class="a" style="--o:0.27; --s:1.02; --r:-1; --sd:153s;"></i></div>
    <div class="puff" style="--x:88.9%; --y:29.8%; --w:90vmin; --dd:40s; --delay:-4s; --dx1:-3.1vmin; --dy1:-5.1vmin; --dx2:2.0vmin; --dy2:3.4vmin;"><i class="b" style="--o:0.33; --s:1.09; --r:1; --sd:85s;"></i></div>
    <div class="puff" style="--x:84.9%; --y:21.0%; --w:101vmin; --dd:33s; --delay:-57s; --dx1:-1.2vmin; --dy1:-0.2vmin; --dx2:5.9vmin; --dy2:4.0vmin;"><i class="c" style="--o:0.28; --s:0.95; --r:-1; --sd:186s;"></i></div>
    <div class="puff" style="--x:20.2%; --y:44.2%; --w:89vmin; --dd:27s; --delay:-33s; --dx1:-0.7vmin; --dy1:-5.8vmin; --dx2:-2.0vmin; --dy2:1.5vmin;"><i class="a" style="--o:0.22; --s:0.96; --r:1; --sd:157s;"></i></div>
    <div class="puff" style="--x:51.1%; --y:13.4%; --w:119vmin; --dd:27s; --delay:-47s; --dx1:-2.8vmin; --dy1:-4.4vmin; --dx2:-0.9vmin; --dy2:4.9vmin;"><i class="b" style="--o:0.30; --s:1.11; --r:1; --sd:102s;"></i></div>
  `;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // '#RRGGBB' or '#RGB' -> 'r, g, b' (the form --smoke needs).
  function hexTriple(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (!Number.isFinite(n)) return DEFAULT_SMOKE;
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  function smokeColor(paletteName) {
    const pal = window.interactivePalette ? window.interactivePalette(paletteName) : null;
    return pal ? hexTriple(pal.dot) : DEFAULT_SMOKE;
  }

  class SmokeTheme {
    constructor() { this.contextType = '2d'; }

    init(canvas, ctx, options) {
      this.canvas = canvas;
      this.ctx = ctx;
      this.opts = options || {};
      this.speed = (options && options.speed) || 1.0;

      // The real background lives in #canvas-container. A settings preview tile is
      // any other real container — it renders the SAME real smoke, scaled to fit,
      // so the preview is accurate. Only the offscreen snapshot canvas (parent =
      // <body>), used to bake the tiny grid thumbnails, gets the static image,
      // because a canvas snapshot can't capture DOM/SVG smoke.
      const parent = canvas.parentElement;
      this._live = !!(parent && parent.id === 'canvas-container');
      const snapshot = !parent || parent === document.body;
      this._snapshot = snapshot;

      if (snapshot) {
        const cw = canvas.clientWidth || canvas.width;
        const ch = canvas.clientHeight || canvas.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width  = Math.max(1, Math.round(cw * dpr));
        canvas.height = Math.max(1, Math.round(ch * dpr));
        this._paintStatic();
        return;
      }

      ensureStyle();
      canvas.style.display = 'none';
      const root = document.createElement('div');
      root.className = 'liv-smoke';
      root.innerHTML = `<div class="stage">${PUFFS}</div><div class="vignette"></div>`;
      this._root = root;
      this._applyVars();

      if (!this._live) {
        // Preview tile: lay out the full-viewport smoke field, then scale it down
        // to fit the tile so it looks exactly like the background, just smaller.
        const vw = window.innerWidth || 1, vh = window.innerHeight || 1;
        const pw = parent.clientWidth || vw, ph = parent.clientHeight || vh;
        const k = Math.max(pw / vw, ph / vh);
        root.style.position = 'absolute'; root.style.top = '0'; root.style.left = '0';
        root.style.width = vw + 'px'; root.style.height = vh + 'px';
        root.style.overflow = 'hidden';
        root.style.transform = 'scale(' + k + ')';
        root.style.transformOrigin = 'top left';
      }

      parent.appendChild(root);
      if (!this._live) return;  // preview is CSS-driven only; no pointer parallax

      // Per-puff pointer reaction (live background only). Each puff records its
      // centre (as a fraction of the viewport) and a running push offset. draw()
      // nudges the puffs near the cursor slightly away — local, gentle, persistent.
      this._puffs = [];
      root.querySelectorAll('.puff').forEach(el => {
        this._puffs.push({
          el,
          fx: (parseFloat(el.style.getPropertyValue('--x')) || 50) / 100,
          fy: (parseFloat(el.style.getPropertyValue('--y')) || 50) / 100,
          tx: 0, ty: 0,   // persistent push target (accumulates, never springs back)
          ox: 0, oy: 0    // eased actual offset
        });
      });
      this._cx = window.innerWidth / 2;
      this._cy = window.innerHeight / 2;
      this._onMove = (e) => { this._cx = e.clientX; this._cy = e.clientY; };
      window.addEventListener('pointermove', this._onMove, { passive: true });
    }

    _applyVars() {
      const root = this._root, o = this.opts;
      if (!root) return;
      root.style.setProperty('--smoke', smokeColor(o.scenePalette));
      const spd = this.speed || 1;                       // engine speed: higher = faster
      root.style.setProperty('--speed', String(spd > 0 ? 1 / spd : 1)); // CSS --speed: higher = slower
      root.style.setProperty('--density', String(o.intensity != null ? o.intensity : 1));
      root.classList.toggle('paused', !!o.staticMode);
    }

    // Static teal approximation for the picker thumbnail (only used if no bundled
    // screenshot is provided). Many overlapping soft wisps read more like smoke
    // than a few blobs, but a real screenshot at assets/thumbs/smoke.jpg wins.
    _paintStatic() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      if (!ctx) return;
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.52, 0, w * 0.5, h * 0.52, Math.max(w, h) * 0.7);
      bg.addColorStop(0, '#0a2024');
      bg.addColorStop(1, '#050a0c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const col = smokeColor(this.opts.scenePalette);
      const d = Math.max(w, h);
      ctx.globalCompositeOperation = 'lighter';
      // Deterministic scatter of soft wisps (seeded LCG so the tile is stable).
      let s = 1337;
      const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      for (let i = 0; i < 16; i++) {
        const bx = 0.5 + (rnd() - 0.5) * 1.05;
        const by = 0.5 + (rnd() - 0.5) * 1.05;
        const br = 0.22 + rnd() * 0.34;
        const al = 0.05 + rnd() * 0.13;
        const g = ctx.createRadialGradient(w * bx, h * by, 0, w * bx, h * by, d * br);
        g.addColorStop(0, `rgba(${col}, ${al})`);
        g.addColorStop(0.55, `rgba(${col}, ${al * 0.35})`);
        g.addColorStop(1, `rgba(${col}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = 'source-over';
      // Vignette so the wisps sit in darkness like the real scene.
      const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, d * 0.25, w * 0.5, h * 0.5, d * 0.72);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    // Live colour swap from the palette swatches — no reload.
    setPreset(name) {
      this.opts.scenePalette = name;
      if (this._live) this._applyVars();
      else this._paintStatic();
    }

    // Live smoke is CSS-driven; per frame we nudge each puff near the cursor a
    // little further away and LEAVE it there — the push accumulates into a
    // persistent target (capped) that never springs back, so the smoke drifts
    // off in the direction it was pushed until the cursor moves it again.
    draw() {
      if (!this._live || !this._puffs) return;
      const w = window.innerWidth, h = window.innerHeight;
      const minDim = Math.min(w, h);
      const radius = PUSH_RADIUS * minDim;
      const step = PUSH_STEP * minDim;
      const maxOff = PUSH_MAX * minDim;
      const cx = this._cx, cy = this._cy;
      for (const p of this._puffs) {
        // Distance from the puff's CURRENT (displaced) position, so once it has
        // drifted out of range the cursor no longer keeps shoving it.
        const dx = (p.fx * w + p.ox) - cx, dy = (p.fy * h + p.oy) - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001 && dist < radius) {
          const fall = 1 - dist / radius;                   // 1 at cursor → 0 at radius
          p.tx += (dx / dist) * step * fall;                // accumulate away from cursor
          p.ty += (dy / dist) * step * fall;
          const m = Math.hypot(p.tx, p.ty);                 // cap so it can't run away
          if (m > maxOff) { p.tx = p.tx / m * maxOff; p.ty = p.ty / m * maxOff; }
        }
        p.ox += (p.tx - p.ox) * PUSH_EASE;                  // ease actual toward the kept target
        p.oy += (p.ty - p.oy) * PUSH_EASE;
        p.el.style.setProperty('--pushx', p.ox.toFixed(1) + 'px');
        p.el.style.setProperty('--pushy', p.oy.toFixed(1) + 'px');
      }
    }
    resize() { if (this._snapshot) this._paintStatic(); } // live & preview are CSS-driven

    start() {}
    stop()  {}

    destroy() {
      if (this._onMove) { window.removeEventListener('pointermove', this._onMove); this._onMove = null; }
      if (this._root) { this._root.remove(); this._root = null; }
      this._puffs = null;
      if (this.canvas) this.canvas.style.display = '';
    }
  }

  window.SmokeTheme = SmokeTheme;
})();

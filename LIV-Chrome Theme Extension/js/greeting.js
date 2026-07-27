'use strict';

// Greeting particle intro. On the first new tab of a browser session (when
// enabled) a time-aware greeting assembles out of particles, swells slightly,
// then scatters — and the real header particles into place behind it.
const Greeting = (() => {

  function canPlay() {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return true; }
  }

  // True once per browser session. chrome.storage.session lives only for the
  // current browser run (cleared on restart), so this greets on each launch —
  // not once per tab, not once per day. Falls back to per-tab sessionStorage.
  async function firstThisSession() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        const { livGreeted } = await chrome.storage.session.get('livGreeted');
        if (livGreeted) return false;
        await chrome.storage.session.set({ livGreeted: true });
        return true;
      }
    } catch (e) { /* fall through */ }
    try {
      if (sessionStorage.getItem('livGreeted')) return false;
      sessionStorage.setItem('livGreeted', '1');
      return true;
    } catch (e) { return true; }
  }

  // Clear the "already greeted this session" flag so the next new tab replays
  // the greeting — used when the user just switches the feature on.
  function resetSession() {
    try { if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session)
            chrome.storage.session.remove('livGreeted'); } catch (e) {}
    try { sessionStorage.removeItem('livGreeted'); } catch (e) {}
  }

  function textFor(name) {
    const h = new Date().getHours();   // local device clock — no network
    const part =
      h >= 5  && h < 12 ? 'Good morning'   :
      h >= 12 && h < 17 ? 'Good afternoon' :
      h >= 17 && h < 22 ? 'Good evening'   :
                          'Good night';    // 22:00–04:59
    name = (name || '').trim();
    return name ? `${part}, ${name}` : part;
  }

  // Rasterise a string to an offscreen canvas and walk the opaque pixels. The
  // points come back in canvas space (text drawn from a fixed pad, baseline at
  // fba+pad) along with the font metrics, so callers can place them to match a
  // real element exactly (using its rect + line box) rather than by eye.
  const PAD = 2;
  function sample(text, fontPx, family, weight, letterSpacing, targetCount) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const font = `${weight || 600} ${fontPx}px ${family}`;
    const setFont = () => { g.font = font; if (letterSpacing) { try { g.letterSpacing = letterSpacing; } catch (e) {} } };
    setFont();
    const m = g.measureText(text);
    const fba = m.fontBoundingBoxAscent  || fontPx * 0.8;
    const fbd = m.fontBoundingBoxDescent || fontPx * 0.2;
    const w = Math.ceil(m.width) + PAD * 2;
    const h = Math.ceil(fba + fbd) + PAD * 2;
    c.width = w; c.height = h;
    setFont();
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff';
    g.fillText(text, PAD, fba + PAD);
    const data = g.getImageData(0, 0, w, h).data;
    let pts = [];
    const step = Math.max(2, Math.round(fontPx / 28));
    for (let y = 0; y < h; y += step)
      for (let x = 0; x < w; x += step)
        if (data[(y * w + x) * 4 + 3] > 130) pts.push([x, y]);
    if (targetCount && pts.length > targetCount) {
      const keep = targetCount / pts.length;
      pts = pts.filter(() => Math.random() < keep);
    }
    return { pts, width: m.width, fba, fbd };
  }

  // The header's main line plus everything needed to rebuild it from particles
  // exactly where the browser draws it: its client rect and resolved font.
  function headerTarget() {
    const pick =
      !document.getElementById('header-logo').hidden  ? document.querySelector('#header-logo .wordmark') :
      !document.getElementById('header-time').hidden  ? document.getElementById('clock-hm') :
                                                        document.getElementById('date-weekday');
    const el = pick || document.querySelector('#header-logo .wordmark');
    const r  = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const ls = parseFloat(cs.letterSpacing);
    return {
      text: (el.textContent || 'LIV').trim() || 'LIV',
      left: r.left, top: r.top, width: r.width, height: r.height,
      fontPx: parseFloat(cs.fontSize) || 64,
      family: cs.fontFamily,
      weight: cs.fontWeight,
      letterSpacing: isFinite(ls) ? ls : 0,
    };
  }

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIO  = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp    = (a, b, t) => a + (b - a) * t;

  function play(text, onReveal) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.id = 'greeting-canvas';
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:100;pointer-events:none;transition:opacity .35s ease;';
    document.body.appendChild(canvas);
    const g = canvas.getContext('2d');
    const W = canvas.width  = Math.floor(window.innerWidth  * dpr);
    const H = canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';

    const uiFamily = getComputedStyle(document.documentElement)
      .getPropertyValue('--ui-font').trim() || 'sans-serif';

    // Greeting geometry — centred, sized to the viewport (and shrunk to fit width).
    let greetPx = Math.min(window.innerWidth * 0.072, 58) * dpr;
    {
      const probe = document.createElement('canvas').getContext('2d');
      probe.font = `600 ${greetPx}px ${uiFamily}`;
      const tw = probe.measureText(text).width;
      const maxW = W * 0.86;
      if (tw > maxW) greetPx *= maxW / tw;
    }
    const gcx = W / 2, gcy = H * 0.44;
    // Greeting particles centred on (gcx,gcy) by the text's bounding-box centre;
    // drawSolid() draws the solid word from the matching origin so it overlays.
    const gs = sample(text, greetPx, uiFamily, 600, null, 1800);
    const grx = PAD + gs.width / 2, gry = PAD + (gs.fba + gs.fbd) / 2;
    const gp = gs.pts.map(([px, py]) => {
      const tx = gcx + (px - grx), ty = gcy + (py - gry);
      const a = Math.random() * Math.PI * 2, r = (70 + Math.random() * 170) * dpr;
      return { tx, ty, sx: tx + Math.cos(a) * r, sy: ty + Math.sin(a) * r,
               ox: Math.cos(a), oy: Math.sin(a) - 0.35, delay: Math.random() * 0.28 };
    });

    // Header particles placed onto the real header exactly: the horizontal origin
    // is the element's left edge; the vertical origin is the line box's content
    // top (half-leading), so the glyphs sit where the browser draws them — for
    // any logo position (centre, corners, bottom-right…).
    const ht = headerTarget();
    const lsDev = ht.letterSpacing ? (ht.letterSpacing * dpr) + 'px' : null;
    const hsData = sample(ht.text, ht.fontPx * dpr, ht.family, ht.weight, lsDev, 1200);
    const rx = ht.left * dpr, ry = ht.top * dpr, rh = ht.height * dpr;
    const vOff = (rh - (hsData.fba + hsData.fbd)) / 2 - PAD;
    const hp = hsData.pts.map(([px, py]) => {
      const tx = rx + (px - PAD), ty = ry + vOff + py;
      const a = Math.random() * Math.PI * 2, r = (40 + Math.random() * 90) * dpr;
      return { tx, ty, sx: tx + Math.cos(a) * r, sy: ty + Math.sin(a) * r, delay: Math.random() * 0.3 };
    });

    const dot = 1.7 * dpr;
    const GROW = 1.08;
    // Phase durations (ms) — deliberately slow and lingering.
    const B   = 2100;   // particles gather AND solidify into the word together
    const Hn  = 2000;   // solid greeting holds (with a gentle swell)
    const D   = 1600;   // word breaks apart into particles that drift and fade
    const Hdr = 2000;   // header particles gather into place
    const tB = B, tH = tB + Hn, tD = tH + D, tEnd = tD + Hdr;
    let start = 0, raf = 0, revealed = false;

    const clamp = t => Math.min(1, Math.max(0, t));

    const draw = pts => {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.a <= 0) continue;
        g.globalAlpha = p.a;
        g.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
      }
      g.globalAlpha = 1;
    };

    // The greeting as solid text, drawn from the *exact* same origin the
    // particles were sampled from (left edge + baseline), so it sits pixel-on-
    // pixel over them — the word just fills in rather than a second layer
    // appearing next to it. Scale happens around the greeting centre.
    const solidX = gcx - gs.width / 2;
    const solidBaseline = gcy + (gs.fba - gs.fbd) / 2;
    const drawSolid = (scale, alpha) => {
      g.save();
      g.globalAlpha = alpha;
      g.translate(gcx, gcy);
      g.scale(scale, scale);
      g.translate(-gcx, -gcy);
      g.font = `600 ${greetPx}px ${uiFamily}`;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(255,255,255,0.96)';
      g.fillText(text, solidX, solidBaseline);
      g.restore();
      g.globalAlpha = 1;
    };
    const grownX = p => gcx + (p.tx - gcx) * GROW;
    const grownY = p => gcy + (p.ty - gcy) * GROW;

    const frame = ts => {
      if (!start) start = ts;
      const e = ts - start;
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.94)';

      if (e < tB) {
        // Build: particles drift together and the solid word fills in over them
        // as they arrive — one continuous motion, no separate fuse step.
        const bp = e / tB;
        for (const p of gp) {
          const k = easeOut(clamp((bp - p.delay) / (1 - p.delay)));
          p.x = lerp(p.sx, p.tx, k); p.y = lerp(p.sy, p.ty, k); p.a = k;
        }
        draw(gp);
        drawSolid(1, easeIO(clamp((bp - 0.4) / 0.6)));
      } else if (e < tH) {
        // Hold: solid text with a gentle swell, then steady.
        const scale = 1 + (GROW - 1) * easeIO(Math.min(1, (e - tB) / 700));
        drawSolid(scale, 1);
      } else if (e < tD) {
        // Scatter: the word breaks apart — particles peel off and drift/fade as
        // the solid fades out from under them.
        const sp = (e - tH) / D, k = sp * sp;
        for (const p of gp) {
          p.x = grownX(p) + p.ox * k * 110 * dpr;
          p.y = grownY(p) + p.oy * k * 110 * dpr;
          p.a = 1 - easeIO(sp);
        }
        draw(gp);
        drawSolid(GROW, 1 - clamp(sp / 0.5));
      } else {
        // Header: particles gather into the real header's position.
        const dt = (e - tD) / Hdr;
        for (const p of hp) {
          const k = easeOut(clamp((dt - p.delay) / (1 - p.delay)));
          p.x = lerp(p.sx, p.tx, k); p.y = lerp(p.sy, p.ty, k); p.a = k;
        }
        draw(hp);
      }

      if (e >= tEnd) {
        if (!revealed) {
          revealed = true;
          // The last frame leaves the fully-formed header particles frozen on
          // top. Fade the real header in beneath them first…
          if (onReveal) onReveal();
          // …then, once it's in, fade the particle layer out over it. Same shape,
          // same place, so it dissolves into the real header without a blink.
          setTimeout(() => {
            canvas.style.transition = 'opacity 0.6s ease';
            canvas.style.opacity = '0';
            setTimeout(() => canvas.remove(), 650);
          }, 620);
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Safety: never leave the header hidden if something goes wrong.
    setTimeout(() => { if (!revealed && onReveal) { revealed = true; onReveal(); } }, tEnd + 1500);
  }

  return { canPlay, firstThisSession, resetSession, textFor, play };
})();

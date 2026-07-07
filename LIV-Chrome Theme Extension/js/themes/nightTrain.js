'use strict';

(function () {

  const TAU = Math.PI * 2;

  // Quasi-Gaussian sample in roughly [-2, 2] — sums of uniforms, cheap and
  // smooth, used everywhere something should scatter naturally instead of
  // uniformly.
  function gauss() {
    return Math.random() + Math.random() + Math.random() + Math.random() - 2;
  }

  // Night Train — riding alongside a night train crossing an endless viaduct.
  // The camera paces the train: one train, always heading right, held in
  // frame while the world slides past in parallax — arches and their
  // reflection at track speed, the near shore slower, far ridges slower
  // still, and the sky not at all.
  // Realism comes from restraint:
  //   1. the sky is painted once — a deep low-res blurred gradient, a faint
  //      band of galaxy light, and a moon with its real maria — and it never
  //      moves; stars keep their positions and only scintillate
  //   2. the moonglade is physical: a soft column with a Gaussian lateral
  //      profile, built from hundreds of horizontal wave-facet glints that
  //      are dense and fused at the horizon, sparse and long near the
  //      viewer, each one a blurred streak rather than a drawn shape
  //   3. clouds are layered puff masses — lit on top, shaded underneath —
  //      that brighten as they drift past the moon
  class NightTrainTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = 0;
      this._lastTs   = null;
      this._meteor   = null;
      this._meteorIn = 14 + Math.random() * 26;
      this._build(canvas.width, canvas.height);
    }

    resize(w, h) {
      this._build(w, h);
    }

    // ── Scene construction ─────────────────────────────────────────────────

    _build(w, h) {
      this._cW = w;
      this._cH = h;
      const u = this._u = Math.max(0.7, Math.min(2.5, w / 1400));

      // Layout anchors. The viaduct sits mid-distance: parapet band on top,
      // arched piers below it down to the waterline, train riding just above
      // the parapet so its running gear stays hidden.
      this._hor      = h * 0.700;   // waterline
      this._parTop   = h * 0.582;   // top edge of the parapet
      this._deckBot  = h * 0.614;   // underside of the deck band
      this._spring   = h * 0.652;   // arch springing line
      this._crown    = h * 0.624;   // arch crowns
      this._trainBot = h * 0.598;   // carriage bodies dip behind the parapet
      this._coachH   = h * 0.048;
      this._mx       = w * 0.705;
      this._my       = h * 0.205;
      this._mr       = Math.max(16 * u, h * 0.036);
      this._pierSp   = Math.max(150 * u, w * 0.115);

      this._scroll = 0;
      this._trSp   = 105 * u;       // track speed the camera is matching

      this._buildSky();
      this._buildHills();
      this._buildWater();
      this._buildBridge();
      this._buildWisps();
      this._buildStars();
      this._buildGlitter();
      this._buildWaterLines();
      this._buildVignette();

      // The one train, held in frame by the pacing camera.
      this._trS = this._makeTrain();
      this._trX = (w - this._trS.w) * 0.40;
    }

    _buildSky() {
      const w = this._cW, h = this._cH, u = this._u;

      // Painted small and upscaled with a blur so the gradients never band.
      const lw = Math.max(2, Math.ceil(w / 6)), lh = Math.max(2, Math.ceil(h / 6));
      const low = document.createElement('canvas');
      low.width = lw; low.height = lh;
      const lc = low.getContext('2d');

      const g = lc.createLinearGradient(0, 0, 0, lh);
      g.addColorStop(0,    '#04060d');
      g.addColorStop(0.40, '#081020');
      g.addColorStop(0.72, '#101a30');
      g.addColorStop(1,    '#1a2740');
      lc.fillStyle = g;
      lc.fillRect(0, 0, lw, lh);

      // Faint airglow pooled at the horizon.
      const hg = lc.createLinearGradient(0, lh * 0.62, 0, lh);
      hg.addColorStop(0, 'rgba(90,115,160,0)');
      hg.addColorStop(1, 'rgba(120,145,185,0.20)');
      lc.fillStyle = hg;
      lc.fillRect(0, lh * 0.62, lw, lh * 0.38);

      // A soft band of galaxy light tilted across the upper sky.
      lc.save();
      lc.translate(lw * 0.35, lh * 0.30);
      lc.rotate(-0.38);
      for (let i = 0; i < 16; i++) {
        const x = (Math.random() - 0.5) * lw * 1.2;
        const y = (Math.random() - 0.5) * lh * 0.14;
        const r = lh * (0.05 + Math.random() * 0.10);
        const gg = lc.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, `rgba(180,196,228,${0.03 + Math.random() * 0.035})`);
        gg.addColorStop(1, 'rgba(180,196,228,0)');
        lc.fillStyle = gg;
        lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
      }
      lc.restore();

      // Large-scale unevenness so the night never reads flat.
      for (let i = 0; i < 7; i++) {
        const x = Math.random() * lw, y = Math.random() * lh * 0.6;
        const r = lh * (0.15 + Math.random() * 0.2);
        const gg = lc.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, Math.random() < 0.5 ? 'rgba(2,4,9,0.14)' : 'rgba(30,44,74,0.12)');
        gg.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = gg;
        lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
      }

      const sky = document.createElement('canvas');
      sky.width = w; sky.height = h;
      const sc = sky.getContext('2d');
      sc.imageSmoothingEnabled = true;
      sc.imageSmoothingQuality = 'high';
      sc.filter = 'blur(' + Math.max(2, 3 * u) + 'px)';
      sc.drawImage(low, -8, -8, w + 16, h + 16);
      sc.filter = 'none';

      this._paintMoon(sc);
      this._sky = sky;
    }

    _paintMoon(sc) {
      const x = this._mx, y = this._my, r = this._mr;

      // Broad atmospheric halo, then a tighter glow hugging the disc.
      let g = sc.createRadialGradient(x, y, r * 0.6, x, y, r * 7);
      g.addColorStop(0,    'rgba(205,218,245,0.20)');
      g.addColorStop(0.25, 'rgba(195,210,240,0.07)');
      g.addColorStop(1,    'rgba(195,210,240,0)');
      sc.fillStyle = g;
      sc.beginPath(); sc.arc(x, y, r * 7, 0, TAU); sc.fill();

      g = sc.createRadialGradient(x, y, r * 0.8, x, y, r * 2.1);
      g.addColorStop(0, 'rgba(230,238,255,0.30)');
      g.addColorStop(1, 'rgba(230,238,255,0)');
      sc.fillStyle = g;
      sc.beginPath(); sc.arc(x, y, r * 2.1, 0, TAU); sc.fill();

      // Disc, lit a touch off-center.
      g = sc.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0,    '#faf7ec');
      g.addColorStop(0.65, '#eee9da');
      g.addColorStop(1,    '#cfc9b8');
      sc.fillStyle = g;
      sc.beginPath(); sc.arc(x, y, r, 0, TAU); sc.fill();

      // Maria — the familiar face, kept soft and low-contrast.
      sc.save();
      sc.beginPath(); sc.arc(x, y, r, 0, TAU); sc.clip();
      const maria = [
        [-0.32, -0.28, 0.38, 0.15], [0.05, -0.38, 0.26, 0.13],
        [ 0.30, -0.12, 0.30, 0.14], [0.55, -0.28, 0.14, 0.11],
        [-0.10,  0.22, 0.34, 0.10], [0.28,  0.30, 0.18, 0.09],
      ];
      for (const m of maria) {
        const mx = x + m[0] * r, my = y + m[1] * r, mr = m[2] * r;
        const mg = sc.createRadialGradient(mx, my, 0, mx, my, mr);
        mg.addColorStop(0,   `rgba(96,104,118,${m[3]})`);
        mg.addColorStop(0.7, `rgba(96,104,118,${m[3] * 0.55})`);
        mg.addColorStop(1,   'rgba(96,104,118,0)');
        sc.fillStyle = mg;
        sc.beginPath(); sc.arc(mx, my, mr, 0, TAU); sc.fill();
      }
      // Limb shading where the sphere turns away.
      const limb = sc.createRadialGradient(x, y, r * 0.55, x, y, r);
      limb.addColorStop(0, 'rgba(0,0,0,0)');
      limb.addColorStop(1, 'rgba(40,42,52,0.22)');
      sc.fillStyle = limb;
      sc.beginPath(); sc.arc(x, y, r, 0, TAU); sc.fill();
      sc.restore();
    }

    _buildHills() {
      const w = this._cW, h = this._cH;
      const period = Math.ceil(Math.max(560 * this._u, w * 0.55));
      this._hillFar  = this._makeRidge(period, h * 0.585, h * 0.038,
        [[1, 1], [2, 0.5], [3, 0.28]], '#131c2e', '#0d1524', false);
      this._hillNear = this._makeRidge(period, h * 0.652, h * 0.020,
        [[2, 1], [3, 0.6], [5, 0.35]], '#0a1019', '#060910', true);
    }

    // A tileable ridge strip: integer-cycle harmonics so the seam is
    // invisible, painted at quarter scale and upscaled for a soft edge.
    _makeRidge(period, baseY, amp, harm, colTop, colBot, tufts) {
      const top = Math.floor(baseY - amp * 2.4);
      const stripH = Math.ceil(this._hor - top) + 2;
      const s = 4;
      const lw = Math.max(2, Math.ceil(period / s));
      const lh = Math.max(2, Math.ceil(stripH / s));
      const low = document.createElement('canvas');
      low.width = lw; low.height = lh;
      const lc = low.getContext('2d');
      const ph = harm.map(() => Math.random() * TAU);

      lc.beginPath();
      lc.moveTo(0, lh + 2);
      for (let x = 0; x <= lw; x++) {
        let y = (baseY - top) / s;
        for (let k = 0; k < harm.length; k++)
          y -= (amp * harm[k][1] / s) * Math.sin(TAU * harm[k][0] * x / lw + ph[k]);
        // Scrub and treetops — tapered at the ends so the tile still wraps.
        if (tufts) y -= (Math.random() * amp * 0.16 / s) * Math.min(1, Math.min(x, lw - x) / (lw * 0.05));
        lc.lineTo(x, y);
      }
      lc.lineTo(lw, lh + 2);
      lc.closePath();
      const g = lc.createLinearGradient(0, 0, 0, lh);
      g.addColorStop(0, colTop);
      g.addColorStop(1, colBot);
      lc.fillStyle = g;
      lc.fill();

      const strip = document.createElement('canvas');
      strip.width = period; strip.height = stripH;
      const sc = strip.getContext('2d');
      sc.imageSmoothingEnabled = true;
      sc.imageSmoothingQuality = 'high';
      sc.drawImage(low, 0, 0, period, stripH);
      return { c: strip, top };
    }

    // Repeat a periodic strip across the width, phase-shifted by `off`.
    _tile(ctx, strip, off) {
      const sw = strip.c.width;
      off = ((off % sw) + sw) % sw;
      for (let x = -off; x < this._cW; x += sw) ctx.drawImage(strip.c, x, strip.top);
    }

    // A soft horizontal streak sprite — the building block for glints, water
    // texture and anything else that should be light, not linework.
    _makeStreak(wpx, hpx, r, g, b, coreA) {
      const c = document.createElement('canvas');
      c.width  = Math.max(2, Math.ceil(wpx));
      c.height = Math.max(2, Math.ceil(hpx));
      const x = c.getContext('2d');
      x.save();
      x.translate(c.width / 2, c.height / 2);
      x.scale(c.width / c.height, 1);
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, c.height / 2);
      gr.addColorStop(0,    `rgba(${r},${g},${b},${coreA})`);
      gr.addColorStop(0.45, `rgba(${r},${g},${b},${coreA * 0.38})`);
      gr.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr;
      x.beginPath(); x.arc(0, 0, c.height / 2, 0, TAU); x.fill();
      x.restore();
      return c;
    }

    _buildWater() {
      const w = this._cW, h = this._cH, u = this._u;
      const wH = Math.ceil(h - this._hor);
      const wc = document.createElement('canvas');
      wc.width = w; wc.height = wH;
      const c = wc.getContext('2d');

      const g = c.createLinearGradient(0, 0, 0, wH);
      g.addColorStop(0,   '#0e1728');
      g.addColorStop(0.3, '#0a111f');
      g.addColorStop(1,   '#04060c');
      c.fillStyle = g;
      c.fillRect(0, 0, w, wH);

      // Bright sliver of reflected sky right at the waterline.
      const hb = c.createLinearGradient(0, 0, 0, h * 0.018);
      hb.addColorStop(0, 'rgba(150,176,216,0.14)');
      hb.addColorStop(1, 'rgba(150,176,216,0)');
      c.fillStyle = hb;
      c.fillRect(0, 0, w, h * 0.018);

      // ── The moonglade ────────────────────────────────────────────────────
      // No shapes: a column whose lateral profile is Gaussian, painted row by
      // row at quarter resolution, seeded with wave-facet dashes — dense and
      // fused near the horizon, sparse and stretched near the viewer — then
      // blurred and composited additively so it reads as light on water.
      const q = 4;
      const gw = Math.max(2, Math.ceil(w / q));
      const gh = Math.max(2, Math.ceil(wH / q));
      const glow = document.createElement('canvas');
      glow.width = gw; glow.height = gh;
      const gc = glow.getContext('2d');
      const mxl = this._mx / q, mrl = this._mr / q;

      const sigma = (f) => mrl * (0.55 + Math.pow(f, 1.25) * 4.2);

      // Soft underlying column, one faint row at a time.
      for (let y = 0; y < gh; y++) {
        const f = y / gh;
        const sg = sigma(f);
        const a = 0.085 * Math.pow(1 - f, 1.6) + 0.012;
        const lg = gc.createLinearGradient(mxl - 3 * sg, 0, mxl + 3 * sg, 0);
        lg.addColorStop(0,    'rgba(190,208,240,0)');
        lg.addColorStop(0.35, `rgba(190,208,240,${(a * 0.5).toFixed(4)})`);
        lg.addColorStop(0.5,  `rgba(198,214,244,${a.toFixed(4)})`);
        lg.addColorStop(0.65, `rgba(190,208,240,${(a * 0.5).toFixed(4)})`);
        lg.addColorStop(1,    'rgba(190,208,240,0)');
        gc.fillStyle = lg;
        gc.fillRect(mxl - 3 * sg, y, 6 * sg, 1);
      }

      // Wave-facet dashes scattered with a Gaussian spread around the column.
      let yy = 0;
      while (yy < gh) {
        const f = yy / gh;
        const sg = sigma(f);
        const nD = Math.round((2.6 - 1.7 * f) * (0.6 + Math.random() * 0.8));
        for (let i = 0; i < nD; i++) {
          const off = gauss() * sg * 0.8;
          const lat = Math.exp(-(off * off) / (sg * sg * 1.1));
          const len = 1 + (1 + 10 * f) * Math.random();
          const ht  = f < 0.15 ? 1 : 1 + 2.4 * f * Math.random();
          const a   = (0.10 + Math.random() * 0.28) * (1 - 0.5 * f) * (0.4 + 0.6 * lat);
          gc.fillStyle = Math.random() < 0.12
            ? `rgba(226,229,248,${a.toFixed(3)})`
            : `rgba(202,218,246,${a.toFixed(3)})`;
          gc.fillRect(mxl + off - len / 2, yy, len, ht);
        }
        yy += 1 + 4.5 * f * f;
      }

      // The bright fused patch where the glade meets the horizon.
      gc.save();
      gc.translate(mxl, 0.5);
      gc.scale(3.2, 1);
      const burn = gc.createRadialGradient(0, 0, 0, 0, 0, mrl * 2.4);
      burn.addColorStop(0,   'rgba(216,228,252,0.32)');
      burn.addColorStop(0.5, 'rgba(210,224,250,0.10)');
      burn.addColorStop(1,   'rgba(210,224,250,0)');
      gc.fillStyle = burn;
      gc.beginPath(); gc.arc(0, 0, mrl * 2.4, 0, TAU); gc.fill();
      gc.restore();

      c.save();
      c.globalCompositeOperation = 'lighter';
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.filter = 'blur(' + Math.max(2, 2.2 * u) + 'px)';
      c.drawImage(glow, 0, 0, w, wH);
      c.restore();

      this._water = wc;
    }

    // The viaduct as a seamless tile: an integer number of arch bays with the
    // boundary piers un-jittered, painted with side padding so the blur never
    // thins the seam. Its reflection tiles with the same period.
    _buildBridge() {
      const w = this._cW, h = this._cH, u = this._u;
      const bandTop = Math.floor(this._parTop);
      const bandH   = Math.ceil(this._hor - bandTop) + Math.ceil(3 * u);
      const sp = this._pierSp;
      const pw = sp * 0.20;
      const P   = Math.round(sp * 6);
      const pad = Math.ceil(24 * u);
      const s = 3;
      const lw = Math.max(2, Math.ceil((P + 2 * pad) / s));
      const lh = Math.max(2, Math.ceil(bandH / s));
      const low = document.createElement('canvas');
      low.width = lw; low.height = lh;
      const lc = low.getContext('2d');

      const g = lc.createLinearGradient(0, 0, 0, lh);
      g.addColorStop(0,    '#0e1523');
      g.addColorStop(0.35, '#0a0f1a');
      g.addColorStop(1,    '#060a11');
      lc.fillStyle = g;
      lc.fillRect(0, 0, lw, lh);

      // Six bays per tile; interior piers get a little jitter, the boundary
      // piers stay exact so the tile wraps.
      const px = [];
      for (let k = 0; k <= 6; k++)
        px.push(k * sp + (k === 0 || k === 6 ? 0 : (Math.random() - 0.5) * 7 * u));
      const crowns = [];
      for (let k = 0; k < 6; k++) crowns.push((Math.random() - 0.5) * h * 0.006);

      const springY = (this._spring - bandTop) / s;
      const botY    = (this._hor - bandTop) / s + 2;
      lc.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 6; k++) {
        for (const shift of [-P, 0, P]) {
          const L = (pad + px[k] + pw / 2 + shift) / s;
          const R = (pad + px[k + 1] - pw / 2 + shift) / s;
          if (R < 0 || L > lw || R <= L) continue;
          const crownY = (this._crown - bandTop + crowns[k]) / s;
          const flare = (pw * 0.26) / s;
          lc.beginPath();
          lc.moveTo(L + flare, botY);
          lc.lineTo(L, springY);
          lc.quadraticCurveTo((L + R) / 2, 2 * crownY - springY, R, springY);
          lc.lineTo(R - flare, botY);
          lc.closePath();
          lc.fill();
        }
      }
      lc.globalCompositeOperation = 'source-over';

      // Padded full-res temp, blurred soft; the tile is its clean center.
      const temp = document.createElement('canvas');
      temp.width = P + 2 * pad; temp.height = bandH;
      const tc = temp.getContext('2d');
      tc.imageSmoothingEnabled = true;
      tc.imageSmoothingQuality = 'high';
      tc.filter = 'blur(' + Math.max(1, 1.1 * u) + 'px)';
      tc.drawImage(low, 0, 0, P + 2 * pad, bandH);
      tc.filter = 'none';

      const tile = document.createElement('canvas');
      tile.width = P; tile.height = bandH;
      const sc = tile.getContext('2d');
      sc.drawImage(temp, pad, 0, P, bandH, 0, 0, P, bandH);
      // Moonlight grazing the parapet top (the moon-side boost is painted
      // live, since the tile scrolls and the light must not).
      sc.fillStyle = 'rgba(188,205,238,0.10)';
      sc.fillRect(0, 0.4 * u, P, 1.4 * u);
      sc.fillStyle = 'rgba(0,0,0,0.32)';
      sc.fillRect(0, this._deckBot - bandTop - u, P, 2.5 * u);

      this._bridge  = tile;
      this._bridgeY = bandTop;
      this._bP      = P;

      // Reflection tile: squashed, blurred, fading with depth, pier footings
      // smudged into the water. Same period, same padding trick.
      const rh = Math.ceil(h * 0.12);
      const refTemp = document.createElement('canvas');
      refTemp.width = P + 2 * pad; refTemp.height = rh;
      const rc = refTemp.getContext('2d');
      rc.save();
      rc.filter = 'blur(' + Math.max(2, 2.2 * u) + 'px)';
      rc.scale(1, -0.8);
      rc.drawImage(temp, 0, -bandH);
      rc.restore();
      rc.globalCompositeOperation = 'destination-in';
      const fade = rc.createLinearGradient(0, 0, 0, rh);
      fade.addColorStop(0,    'rgba(0,0,0,0.30)');
      fade.addColorStop(0.85, 'rgba(0,0,0,0)');
      rc.fillStyle = fade;
      rc.fillRect(0, 0, P + 2 * pad, rh);
      rc.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 6; k++) {
        for (const shift of [-P, 0, P]) {
          const sx = pad + px[k] + shift;
          if (sx < -pw * 3 || sx > P + 2 * pad + pw * 3) continue;
          rc.save();
          rc.translate(sx, 2 * u);
          rc.scale(2.2, 1);
          const sm = rc.createRadialGradient(0, 0, 0, 0, 0, pw * 1.4);
          sm.addColorStop(0, 'rgba(2,4,8,0.40)');
          sm.addColorStop(1, 'rgba(2,4,8,0)');
          rc.fillStyle = sm;
          rc.beginPath(); rc.arc(0, 0, pw * 1.4, 0, TAU); rc.fill();
          rc.restore();
        }
      }
      const ref = document.createElement('canvas');
      ref.width = P; ref.height = rh;
      ref.getContext('2d').drawImage(refTemp, pad, 0, P, rh, 0, 0, P, rh);
      this._bref = ref;
    }

    // Clouds. Two real kinds instead of stretched blobs: fibrous cirrus
    // strands up high, and low broken cumulus — clusters of lobed cells with
    // billowing lit tops, shaded flat-ish bases and ragged edges. Sprites
    // keep close to their painted aspect ratio so nothing gets smeared into
    // an oval on the way up.
    _buildWisps() {
      const w = this._cW, h = this._cH, u = this._u;
      this._wisps = [];

      const mkLow = (lw, lh) => {
        const c = document.createElement('canvas');
        c.width = lw; c.height = lh;
        return c;
      };
      const puff = (lc, x, y, r, sx, col, a) => {
        const gr = lc.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${col},${a.toFixed(3)})`);
        gr.addColorStop(0.6, `rgba(${col},${(a * 0.45).toFixed(3)})`);
        gr.addColorStop(1, `rgba(${col},0)`);
        lc.save();
        lc.translate(x, y); lc.scale(sx, 1); lc.translate(-x, -y);
        lc.fillStyle = gr;
        lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
        lc.restore();
      };
      const upscale = (low, ww, wh) => {
        const spr = document.createElement('canvas');
        spr.width = ww; spr.height = wh;
        const sc = spr.getContext('2d');
        sc.imageSmoothingEnabled = true;
        sc.imageSmoothingQuality = 'high';
        sc.drawImage(low, 0, 0, ww, wh);
        return spr;
      };

      // High cirrus: a few thin strands, each fading in and out along its
      // length so the ends fray instead of tapering into an oval.
      for (let i = 0; i < 2; i++) {
        const ww = Math.ceil(w * (0.20 + Math.random() * 0.18));
        const wh = Math.ceil(h * (0.020 + Math.random() * 0.014));
        const lw = 200, lh = 24;
        const low = mkLow(lw, lh);
        const lc = low.getContext('2d');
        const strands = 3 + ((Math.random() * 2) | 0);
        for (let sI = 0; sI < strands; sI++) {
          const y0 = lh * (0.20 + Math.random() * 0.55);
          const slope = (Math.random() - 0.5) * lh * 0.5;
          const t0 = Math.random() * 0.22, t1 = 0.78 + Math.random() * 0.22;
          const ph1 = Math.random() * TAU, f1 = 2 + Math.random() * 3;
          for (let k = 0; k < 34; k++) {
            const tt = t0 + (t1 - t0) * (k / 33);
            const den = Math.max(0, Math.sin(Math.PI * (tt - t0) / (t1 - t0)) *
                        (0.55 + 0.45 * Math.sin(tt * f1 * TAU + ph1)));
            if (den < 0.12) continue;
            const x = lw * tt + gauss() * 2;
            const y = y0 + slope * (tt - 0.5) * 2 + gauss() * lh * 0.05;
            puff(lc, x, y, lh * (0.05 + Math.random() * 0.09), 3.5 + Math.random() * 2,
                 Math.random() < 0.35 ? '196,210,238' : '150,168,200',
                 (0.032 + Math.random() * 0.032) * den);
          }
        }
        this._wisps.push({
          c: upscale(low, ww, wh),
          x: Math.random() * w,
          y: h * (0.15 + i * 0.07 + Math.random() * 0.05),
          sp: (2.6 + Math.random() * 2.6) * u,
          a: 0.55 + Math.random() * 0.30,
        });
      }

      // Low broken cumulus drifting near the ridgeline.
      const bands = [[0.42, 0.48], [0.46, 0.52], [0.50, 0.55]];
      for (let i = 0; i < 3; i++) {
        const ww = Math.ceil(w * (0.09 + Math.random() * 0.11));
        const wh = Math.ceil(Math.min(h * 0.07, ww * (0.30 + Math.random() * 0.12)));
        const lw = 120, lh = 40;
        const low = mkLow(lw, lh);
        const lc = low.getContext('2d');

        // A handful of lobe cells strung loosely left to right.
        const nc = 2 + ((Math.random() * 3) | 0);
        const cells = [];
        for (let j = 0; j < nc; j++) {
          cells.push({
            x: lw * (0.25 + 0.5 * j / (nc - 1) + (Math.random() - 0.5) * 0.14),
            y: lh * (0.48 + Math.random() * 0.16),
            r: lh * (0.16 + Math.random() * 0.16),
          });
        }
        const pick = () => cells[(Math.random() * nc) | 0];

        // Body: dense cores thinning toward the edges.
        for (let k = 0; k < 34; k++) {
          const cl = pick();
          const x = cl.x + gauss() * cl.r * 1.5;
          const y = cl.y + gauss() * cl.r * 0.55;
          puff(lc, x, y, cl.r * (0.45 + Math.random() * 0.5), 1.3 + Math.random() * 0.5,
               '126,146,180', 0.050 + Math.random() * 0.040);
        }
        // Billowing moonlit lobes along the top.
        for (let k = 0; k < 20; k++) {
          const cl = pick();
          const ang = -Math.PI * (0.15 + Math.random() * 0.70);
          const x = cl.x + Math.cos(ang) * cl.r * (0.7 + Math.random() * 0.7);
          const y = cl.y + Math.sin(ang) * cl.r * (0.8 + Math.random() * 0.5);
          puff(lc, x, y, cl.r * (0.20 + Math.random() * 0.30), 1.2 + Math.random() * 0.5,
               '202,216,244', 0.060 + Math.random() * 0.050);
        }
        // Flat shaded base under the lobes.
        for (let k = 0; k < 10; k++) {
          const cl = pick();
          const x = cl.x + (Math.random() - 0.5) * cl.r * 2.2;
          const y = cl.y + cl.r * (0.45 + Math.random() * 0.35);
          puff(lc, x, y, cl.r * (0.30 + Math.random() * 0.30), 2.0,
               '8,14,28', 0.045 + Math.random() * 0.030);
        }
        // Stray tufts so the silhouette frays at the edges.
        for (let k = 0; k < 6; k++) {
          puff(lc, lw * (0.08 + Math.random() * 0.84), lh * (0.30 + Math.random() * 0.40),
               lh * (0.05 + Math.random() * 0.07), 1.6 + Math.random(),
               '150,168,200', 0.030 + Math.random() * 0.025);
        }

        const band = bands[i];
        this._wisps.push({
          c: upscale(low, ww, wh),
          x: Math.random() * w,
          y: h * (band[0] + Math.random() * (band[1] - band[0])),
          sp: (2.2 + Math.random() * 2.6) * u,
          a: 0.55 + Math.random() * 0.35,
        });
      }
    }

    _buildStars() {
      const w = this._cW, h = this._cH, u = this._u;
      this._stars = [];
      const n = Math.round(170 * this.intensity);
      const ex = this._mr * 2.6;
      for (let i = 0; i < n; i++) {
        const x = Math.random() * w;
        const y = Math.pow(Math.random(), 1.25) * h * 0.60;
        const dx = x - this._mx, dy = y - this._my;
        if (dx * dx + dy * dy < ex * ex) continue;   // washed out by the moon
        const mag = Math.pow(Math.random(), 2.2);
        const r = Math.random();
        this._stars.push({
          x, y,
          col: r < 0.78 ? '214,226,252' : (r < 0.93 ? '255,236,208' : '190,208,255'),
          // Atmospheric extinction dims the ones near the horizon.
          a: (0.22 + mag * 0.68) * (1 - 0.55 * Math.pow(y / (h * 0.62), 2)),
          s: (0.6 + mag * 1.7) * Math.min(u, 1.6),
          ph: Math.random() * TAU,
          rate: 0.5 + Math.random() * 2.2,
          amp: 0.10 + Math.random() * 0.28,
        });
      }
    }

    // Animated glints riding the glade: Gaussian-scattered around the moon's
    // column like the baked dashes beneath them, but alive — each one a soft
    // streak sprite that flares, dies and sways.
    _buildGlitter() {
      const h = this._cH, u = this._u, hor = this._hor;
      const mr = this._mr, mx = this._mx;
      this._glintSpr = [
        this._makeStreak(48, 16, 236, 243, 255, 0.90),
        this._makeStreak(48, 16, 206, 222, 250, 0.55),
      ];
      this._glitter = [];
      let y = hor + 1.5 * u, stepY = 1.7 * u;
      while (y < h) {
        const f = (y - hor) / (h - hor);
        const sg = mr * (0.55 + Math.pow(f, 1.25) * 4.2);
        const nD = Math.max(1, Math.round((2.6 - 1.8 * f) * this.intensity * (0.5 + Math.random())));
        for (let i = 0; i < nD; i++) {
          const off = gauss() * sg * 0.75;
          const lat = Math.exp(-(off * off) / (sg * sg * 1.4));
          this._glitter.push({
            x: mx + off, y,
            lw: (3 + (4 + 26 * f) * Math.random()) * u,
            lh: Math.max(1.2, (1 + 3.4 * f) * u),
            a: (0.16 + Math.random() * 0.38) * (1 - 0.40 * f) * (0.35 + 0.65 * lat),
            ph: Math.random() * TAU,
            rate: 1.0 + Math.random() * 3.2,
            sway: sg * (0.02 + Math.random() * 0.05),
            si: Math.random() < 0.35 ? 0 : 1,
          });
        }
        y += stepY;
        stepY *= 1.085;
      }
    }

    _buildWaterLines() {
      const w = this._cW, h = this._cH, u = this._u;
      // Faint streaks of surface texture. Each carries its own parallax
      // factor — water lower in frame is nearer, so it streams past faster.
      this._lineSpr = this._makeStreak(128, 10, 172, 193, 224, 0.50);
      this._waterLines = [];
      const n = Math.round(10 * this.intensity);
      for (let i = 0; i < n; i++) {
        const y = this._hor + h * 0.03 + Math.random() * (h - this._hor - h * 0.05);
        const f = (y - this._hor) / (h - this._hor);
        this._waterLines.push({
          x: Math.random() * w, y,
          len: w * (0.10 + Math.random() * 0.22),
          ht: (2 + 2.4 * f) * u,
          a: 0.035 + Math.random() * 0.05,
          sp: (8 + Math.random() * 10) * u,
          par: 0.55 + 1.1 * Math.pow(f, 1.3),
        });
      }
    }

    _buildVignette() {
      const w = this._cW, h = this._cH;
      const vig = document.createElement('canvas');
      vig.width = w; vig.height = h;
      const c = vig.getContext('2d');
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42,
                                       w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(3,5,10,0)');
      g.addColorStop(1, 'rgba(3,5,10,0.30)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      this._vig = vig;
    }

    // ── The train ──────────────────────────────────────────────────────────

    // The train as a sprite: a locomotive with a rounded nose leading a
    // handful of sleeper coaches, always facing right. Bodies and window
    // halos are baked (drawn at half resolution and upscaled so nothing is
    // hard-edged); the lit panes are drawn each frame so they can flicker.
    _makeTrain() {
      const u = this._u;
      const coachH  = this._coachH;
      const ln      = coachH * 3.4;
      const gap     = Math.max(2, coachH * 0.10);
      const locoLen = coachH * 2.1;
      const locoH   = coachH * 1.10;
      const PAD     = Math.ceil(coachH * 0.7);
      const n       = 5 + ((Math.random() * 3) | 0);
      const spriteW = Math.ceil(PAD * 2 + n * (ln + gap) + locoLen);
      const spriteH = Math.ceil(PAD * 2 + locoH);
      const bodyBot = PAD + locoH;

      const cs = 0.5;
      const low = document.createElement('canvas');
      low.width  = Math.max(2, Math.ceil(spriteW * cs));
      low.height = Math.max(2, Math.ceil(spriteH * cs));
      const lc = low.getContext('2d');
      lc.scale(cs, cs);

      const windows = [];
      const pals = ['255,213,158', '255,199,132', '255,223,176'];
      const coachTop = bodyBot - coachH;
      const rad = coachH * 0.18;

      const bodyGrad = (top) => {
        const g = lc.createLinearGradient(0, top, 0, bodyBot);
        g.addColorStop(0,    '#2e3746');
        g.addColorStop(0.22, '#1b222e');
        g.addColorStop(0.65, '#101620');
        g.addColorStop(1,    '#0b0f16');
        return g;
      };

      let x = PAD;
      const joints = [];
      for (let i = 0; i < n; i++) {
        // Coach body with a softly rounded roof.
        lc.beginPath();
        lc.moveTo(x, bodyBot);
        lc.lineTo(x, coachTop + rad);
        lc.quadraticCurveTo(x, coachTop, x + rad, coachTop);
        lc.lineTo(x + ln - rad, coachTop);
        lc.quadraticCurveTo(x + ln, coachTop, x + ln, coachTop + rad);
        lc.lineTo(x + ln, bodyBot);
        lc.closePath();
        lc.fillStyle = bodyGrad(coachTop);
        lc.fill();
        // Moonlight caught along the roofline; shadowed underframe.
        lc.fillStyle = 'rgba(198,212,242,0.30)';
        lc.fillRect(x + rad * 0.6, coachTop, ln - rad * 1.2, 1.2 * u);
        lc.fillStyle = 'rgba(0,0,0,0.45)';
        lc.fillRect(x, bodyBot - coachH * 0.10, ln, coachH * 0.10);

        // Windows: warm halos baked, panes recorded for per-frame flicker.
        const winW = coachH * 0.24, winH = coachH * 0.30;
        const pitch = coachH * 0.40;
        const winY = coachTop + coachH * 0.28;
        for (let wx = x + coachH * 0.35; wx + winW < x + ln - coachH * 0.35; wx += pitch) {
          if (Math.random() < 0.14) {
            // A dark compartment — just a faint sheen on the glass.
            lc.fillStyle = 'rgba(96,116,146,0.10)';
            lc.fillRect(wx, winY, winW, winH);
            continue;
          }
          const pal = pals[(Math.random() * pals.length) | 0];
          const cx = wx + winW / 2, cy = winY + winH / 2;
          const halo = lc.createRadialGradient(cx, cy, winH * 0.3, cx, cy, winH * 1.8);
          halo.addColorStop(0, `rgba(${pal},0.13)`);
          halo.addColorStop(1, `rgba(${pal},0)`);
          lc.fillStyle = halo;
          lc.fillRect(cx - winH * 1.8, cy - winH * 1.8, winH * 3.6, winH * 3.6);
          windows.push({
            ox: wx, oy: winY, w: winW, h: winH, pal,
            a: 0.55 + Math.random() * 0.35,
            ph: Math.random() * TAU,
            rate: 0.25 + Math.random() * 0.5,
          });
        }
        joints.push(x + ln);
        x += ln + gap;
      }

      // Locomotive at the head, nose rounded away to the right.
      const locoTop = bodyBot - locoH;
      const noseR = locoH * 0.45;
      lc.beginPath();
      lc.moveTo(x, bodyBot);
      lc.lineTo(x, locoTop + rad);
      lc.quadraticCurveTo(x, locoTop, x + rad, locoTop);
      lc.lineTo(x + locoLen - noseR, locoTop);
      lc.quadraticCurveTo(x + locoLen, locoTop, x + locoLen, locoTop + noseR);
      lc.lineTo(x + locoLen, bodyBot);
      lc.closePath();
      lc.fillStyle = bodyGrad(locoTop);
      lc.fill();
      lc.fillStyle = 'rgba(198,212,242,0.32)';
      lc.fillRect(x + rad * 0.6, locoTop, locoLen - noseR - rad, 1.2 * u);
      lc.fillStyle = 'rgba(0,0,0,0.45)';
      lc.fillRect(x, bodyBot - coachH * 0.10, locoLen, coachH * 0.10);
      // Driver's cab window, a cooler light than the sleeper cars.
      windows.push({
        ox: x + coachH * 0.30, oy: locoTop + locoH * 0.26,
        w: coachH * 0.26, h: coachH * 0.26, pal: '186,212,255',
        a: 0.45, ph: Math.random() * TAU, rate: 0.3,
      });
      // Headlight lens baked dim; the live glow is added every frame.
      const noseOy = bodyBot - locoH * 0.38;
      const hgl = lc.createRadialGradient(x + locoLen - 2 * u, noseOy, 0,
                                          x + locoLen - 2 * u, noseOy, 6 * u);
      hgl.addColorStop(0, 'rgba(255,243,216,0.85)');
      hgl.addColorStop(0.3, 'rgba(255,243,216,0.25)');
      hgl.addColorStop(1, 'rgba(255,243,216,0)');
      lc.fillStyle = hgl;
      lc.beginPath(); lc.arc(x + locoLen - 2 * u, noseOy, 6 * u, 0, TAU); lc.fill();

      // Dark gangway connections between the cars.
      lc.fillStyle = '#04060b';
      for (const jx of joints)
        lc.fillRect(jx - 0.5, coachTop + coachH * 0.16, gap + 1, coachH * 0.74);

      const spr = document.createElement('canvas');
      spr.width = spriteW; spr.height = spriteH;
      const sc = spr.getContext('2d');
      sc.imageSmoothingEnabled = true;
      sc.imageSmoothingQuality = 'high';
      sc.drawImage(low, 0, 0, spriteW, spriteH);

      return { c: spr, w: spriteW, h: spriteH, pad: PAD, bodyBot, noseOy, windows };
    }

    // ── Simulation ─────────────────────────────────────────────────────────

    _step(dt) {
      // The world slides past at track speed; everything scales off this.
      this._scroll += this._trSp * dt;

      for (const wp of this._wisps) {
        wp.x -= (wp.sp + this._trSp * 0.025) * dt;
        if (wp.x < -wp.c.width) wp.x = this._cW + 10;
      }
      for (const ln of this._waterLines) {
        ln.x -= (ln.sp + this._trSp * ln.par) * dt;
        if (ln.x + ln.len < 0) ln.x = this._cW + Math.random() * this._cW * 0.2;
      }

      // A meteor now and then; the fixed stars stay put.
      if (this._meteor) {
        const m = this._meteor;
        m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.t >= m.life) this._meteor = null;
      } else {
        this._meteorIn -= dt;
        if (this._meteorIn <= 0) {
          this._meteorIn = 16 + Math.random() * 30;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const sp  = (700 + Math.random() * 500) * this._u;
          const ang = 0.3 + Math.random() * 0.35;
          this._meteor = {
            x: this._cW * (0.15 + Math.random() * 0.7),
            y: this._cH * (0.04 + Math.random() * 0.2),
            vx: Math.cos(ang) * sp * dir,
            vy: Math.sin(ang) * sp,
            t: 0,
            life: 0.55 + Math.random() * 0.35,
          };
        }
      }
    }

    // ── Frame ──────────────────────────────────────────────────────────────

    draw(ts) {
      if (ts === 0) { this._frame(); return; }
      const dt = (this._lastTs != null) ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const sdt = dt * this.speed;
      this._t += sdt;
      if (sdt > 0) this._step(sdt);
      this._frame();
    }

    _frame() {
      const ctx = this.ctx, w = this._cW, h = this._cH, u = this._u;
      const t = this._t, hor = this._hor, scroll = this._scroll;

      // Sky — fixed. Stars scintillate in place.
      ctx.drawImage(this._sky, 0, 0);
      for (const s of this._stars) {
        const a = s.a * (1 - s.amp + s.amp * Math.sin(t * s.rate + s.ph));
        if (a <= 0.01) continue;
        ctx.fillStyle = `rgba(${s.col},${a.toFixed(3)})`;
        if (s.s < 1.4) {
          ctx.fillRect(s.x, s.y, s.s, s.s);
        } else {
          ctx.beginPath(); ctx.arc(s.x, s.y, s.s * 0.62, 0, TAU); ctx.fill();
        }
      }

      if (this._meteor) {
        const m = this._meteor;
        const a = Math.sin(Math.PI * (m.t / m.life)) * 0.7;
        const tx = m.x - m.vx * 0.09, ty = m.y - m.vy * 0.09;
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, `rgba(235,242,255,${a.toFixed(3)})`);
        g.addColorStop(1, 'rgba(235,242,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4 * u;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      }

      // Clouds, brightening as they pass the moon's neighbourhood.
      for (const wp of this._wisps) {
        const cx = wp.x + wp.c.width / 2;
        const d = (cx - this._mx) / (w * 0.26);
        ctx.globalAlpha = Math.min(1, wp.a * (0.72 + 0.65 * Math.exp(-d * d)));
        ctx.drawImage(wp.c, wp.x, wp.y);
        ctx.globalAlpha = 1;
      }

      // The shorelines, drifting with parallax.
      this._tile(ctx, this._hillFar,  scroll * 0.05);
      this._tile(ctx, this._hillNear, scroll * 0.12);

      // Water, with the endless viaduct hanging upside-down in it.
      ctx.drawImage(this._water, 0, hor);
      const P = this._bP;
      let bOff = ((scroll % P) + P) % P;
      const rSway = Math.sin(t * 0.35) * 1.2 * u;
      for (let x = -bOff + rSway - (rSway > 0 ? P : 0); x < w; x += P)
        ctx.drawImage(this._bref, x, hor);

      // The glade's living glints — moonlight stays put while water streams.
      for (const gl of this._glitter) {
        let tw = Math.sin(t * gl.rate + gl.ph);
        if (tw <= 0) continue;
        tw *= tw;
        const a = gl.a * tw * (0.40 + 0.60 * Math.abs(Math.sin(t * 0.53 + gl.ph * 1.9)));
        if (a < 0.015) continue;
        const x = gl.x + Math.sin(t * 0.4 + gl.ph) * gl.sway;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(this._glintSpr[gl.si], x - gl.lw / 2, gl.y - gl.lh / 2, gl.lw, gl.lh);
      }
      ctx.globalAlpha = 1;

      // Surface texture streaming by — nearer water faster.
      for (const ln of this._waterLines) {
        ctx.globalAlpha = ln.a;
        ctx.drawImage(this._lineSpr, ln.x, ln.y - ln.ht / 2, ln.len, ln.ht);
      }
      ctx.globalAlpha = 1;

      // The train — held by the pacing camera, breathing very slowly across
      // the frame, swaying just perceptibly on the rails.
      const tr = this._trS;
      const bob = (Math.sin(t * 2.2) + 0.5 * Math.sin(t * 3.4 + 1.2)) * 0.35 * u;
      const tx = this._trX + Math.sin(t * 0.05) * 8 * u;
      const spriteY = this._trainBot - tr.bodyBot + bob;

      // Carriage light on the water: one diffuse warm bloom under the train,
      // breathing slowly — the way a row of lit windows actually reads on
      // moving water at this distance.
      const cxT = tx + tr.w / 2;
      ctx.save();
      ctx.translate(cxT, hor + 2 * u);
      ctx.scale(tr.w * 0.55, h * 0.060);
      const wbl = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      wbl.addColorStop(0, `rgba(255,208,155,${(0.055 * (0.82 + 0.18 * Math.sin(t * 0.7))).toFixed(3)})`);
      wbl.addColorStop(1, 'rgba(255,208,155,0)');
      ctx.fillStyle = wbl;
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
      ctx.restore();

      ctx.drawImage(tr.c, tx, spriteY);
      for (const wd of tr.windows) {
        const a = wd.a * (0.90 + 0.08 * Math.sin(t * wd.rate + wd.ph));
        ctx.fillStyle = `rgba(${wd.pal},${a.toFixed(3)})`;
        ctx.fillRect(tx + wd.ox, spriteY + wd.oy, wd.w, wd.h);
      }

      // The viaduct in front, streaming past at track speed.
      for (let x = -bOff; x < w; x += P)
        ctx.drawImage(this._bridge, x, this._bridgeY);

      // Fixed moonlight over the scrolling stone: a sheen on the parapet band
      // and a brighter grazing line under the moon.
      const mx = this._mx, bandTop = this._bridgeY;
      const sheen = ctx.createLinearGradient(mx - w * 0.30, 0, mx + w * 0.30, 0);
      sheen.addColorStop(0,   'rgba(150,178,225,0)');
      sheen.addColorStop(0.5, 'rgba(150,178,225,0.06)');
      sheen.addColorStop(1,   'rgba(150,178,225,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(mx - w * 0.30, bandTop, w * 0.60, this._deckBot - bandTop);
      const pline = ctx.createLinearGradient(mx - w * 0.28, 0, mx + w * 0.28, 0);
      pline.addColorStop(0,   'rgba(200,214,244,0)');
      pline.addColorStop(0.5, 'rgba(200,214,244,0.13)');
      pline.addColorStop(1,   'rgba(200,214,244,0)');
      ctx.fillStyle = pline;
      ctx.fillRect(mx - w * 0.28, bandTop + 0.4 * u, w * 0.56, 1.4 * u);

      // Warm spill of carriage light onto the parapet stone.
      const wash = ctx.createRadialGradient(cxT, this._parTop + 6 * u, 0,
                                            cxT, this._parTop + 6 * u, tr.w * 0.45);
      wash.addColorStop(0, 'rgba(255,204,150,0.045)');
      wash.addColorStop(1, 'rgba(255,204,150,0)');
      ctx.fillStyle = wash;
      ctx.fillRect(cxT - tr.w * 0.45, this._parTop - 4 * u,
                   tr.w * 0.9, this._deckBot - this._parTop + 10 * u);

      // Headlight: a tight glow, a beam thrown up the line, and its own
      // column on the water, brighter than the windows.
      const noseSx = tx + tr.w - tr.pad;
      const noseSy = spriteY + tr.noseOy;
      const pulse = 0.9 + 0.1 * Math.sin(t * 7.3);
      const gl2 = ctx.createRadialGradient(noseSx, noseSy, 0, noseSx, noseSy, 18 * u);
      gl2.addColorStop(0, `rgba(255,243,210,${(0.38 * pulse).toFixed(3)})`);
      gl2.addColorStop(1, 'rgba(255,243,210,0)');
      ctx.fillStyle = gl2;
      ctx.beginPath(); ctx.arc(noseSx, noseSy, 18 * u, 0, TAU); ctx.fill();

      const bl = 170 * u;
      const beam = ctx.createLinearGradient(noseSx, 0, noseSx + bl, 0);
      beam.addColorStop(0, `rgba(255,236,195,${(0.10 * pulse).toFixed(3)})`);
      beam.addColorStop(1, 'rgba(255,236,195,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(noseSx, noseSy);
      ctx.lineTo(noseSx + bl, noseSy - 13 * u);
      ctx.lineTo(noseSx + bl, noseSy + 9 * u);
      ctx.closePath();
      ctx.fill();

      // The headlight's patch on the water — a soft pool, not a column.
      ctx.save();
      ctx.translate(noseSx, hor + 2 * u);
      ctx.scale(34 * u, h * 0.045);
      const hbl = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      hbl.addColorStop(0, `rgba(255,240,205,${(0.10 * pulse).toFixed(3)})`);
      hbl.addColorStop(1, 'rgba(255,240,205,0)');
      ctx.fillStyle = hbl;
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
      ctx.restore();

      // Red tail lamp on the last carriage.
      const tailSx = tx + tr.pad;
      const tg = ctx.createRadialGradient(tailSx, noseSy, 0, tailSx, noseSy, 5 * u);
      tg.addColorStop(0, 'rgba(255,84,70,0.55)');
      tg.addColorStop(1, 'rgba(255,84,70,0)');
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.arc(tailSx, noseSy, 5 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,96,80,0.85)';
      ctx.beginPath(); ctx.arc(tailSx, noseSy, 1.4 * u, 0, TAU); ctx.fill();

      ctx.drawImage(this._vig, 0, 0);
    }

    destroy() {
      this._sky = this._water = this._bridge = this._bref = this._vig = null;
      this._hillFar = this._hillNear = null;
      this._wisps = this._stars = this._glitter = this._waterLines = null;
      this._glintSpr = this._lineSpr = null;
      this._trS = this._meteor = null;
    }
  }

  // ── Standalone API (used by preview HTML) ─────────────────────────────────
  let _inst = null, _raf = null, _boundResize = null, _boundVis = null;

  function _debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  function init(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    function resize() {
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      if (_inst) _inst.resize(canvas.width, canvas.height);
    }
    resize();
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;';

    const ctx = canvas.getContext('2d');
    _inst = new NightTrainTheme();
    _inst.init(canvas, ctx, { speed: 1 });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function loop(ts) {
      _raf = requestAnimationFrame(loop);
      _inst.draw(ts);
    }

    _boundResize = _debounce(resize, 150);
    _boundVis = () => {
      if (document.hidden) { cancelAnimationFrame(_raf); _raf = null; }
      else if (!_raf)      { _raf = requestAnimationFrame(loop); }
    };

    window.addEventListener('resize', _boundResize);
    document.addEventListener('visibilitychange', _boundVis);

    if (reduced) { _inst.draw(0); }
    else         { _raf = requestAnimationFrame(loop); }
  }

  function destroy() {
    if (_raf)         { cancelAnimationFrame(_raf); _raf = null; }
    if (_inst)        { _inst.destroy(); _inst = null; }
    if (_boundResize) { window.removeEventListener('resize', _boundResize); _boundResize = null; }
    if (_boundVis)    { document.removeEventListener('visibilitychange', _boundVis); _boundVis = null; }
  }

  window.NightTrainTheme = NightTrainTheme;
  window.NightTrain = { init, destroy };
})();

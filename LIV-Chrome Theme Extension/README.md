# Liv — Animated New Tab

A Chrome extension (Manifest V3) that replaces the new tab page with a high-quality animated background.

**Five themes** — Deep Space · Nebula Drift · Galaxy Spiral · Aurora Borealis · Drift

Zero network requests. Only `storage` permission required.

---

## Load unpacked

1. Open Chrome and go to `chrome://extensions`
2. Toggle on **Developer mode** (top-right switch)
3. Click **Load unpacked**
4. Select the `animated-newtab` folder
5. Open a new tab — the extension is live

To also darken the browser chrome (tab strip / toolbar), load the companion theme:
see `companion-dark-theme/README.md`.

---

## Usage

| Feature | How |
|---------|-----|
| Switch theme | Gear icon → **Appearance** → **Change background** → pick a category, then a scene |
| Search | Type in the search box, press **Enter** |
| Settings | Gear icon, bottom-right corner |
| Quick links | Settings → **Quick Links** → Add link |
| Animation intensity | Settings → **Animation** → Low / Medium / High |
| Pause animation | Settings → **Static mode** |

---

## Themes

| Name | Key | Technique |
|------|-----|-----------|
| Deep Space | `starfield` | Three-layer parallax star field with twinkling, bloom, and shooting stars |
| Nebula Drift | `nebula` | WebGL FBM domain-warped shader (Canvas 2D fallback if WebGL unavailable) |
| Galaxy Spiral | `galaxy` | Logarithmic spiral particle system with differential rotation |
| Aurora Borealis | `aurora` | Sine-wave curtains with additive gradients over a static star field |
| Drift | `particles` | Floating orbs with proximity connection lines |

---

## Performance notes

- One `requestAnimationFrame` loop at all times; pauses when the tab is hidden.
- `devicePixelRatio` capped at 2× — retina without huge canvas cost.
- Respects `prefers-reduced-motion` and the in-app **Static mode** toggle.
- Resize is debounced; particle buffers are rebuilt cleanly.

---

## Icons

The placeholder icons (star motif on dark background) were generated programmatically.
Replace `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png` with your own art when ready.

---

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save theme choice, clock settings, quick links, etc. |

No host permissions. No content scripts. No background service worker.

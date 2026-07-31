# LIV — Animated New Tab

A Chrome extension (Manifest V3) that replaces the new tab page with a high-quality
animated background — a live "home screen" for your browser. Live wallpaper, app-style
shortcuts, a search bar, and a particle greeting, all configurable per background.

**32 backgrounds** across **Space**, **Nature**, **Passing By**, **Math**, **Science**, and **Interactive** — more coming soon.

Zero network requests. Only `storage`, `search`, and `favicon` permissions.

---

## Load unpacked

1. Open Chrome and go to `chrome://extensions`
2. Toggle on **Developer mode** (top-right switch)
3. Click **Load unpacked**
4. Select the `LIV-Chrome Theme Extension` folder
   (or unzip `LIV - Animated New Tab.zip` first and select that folder)
5. Open a new tab — the extension is live

To also darken the browser chrome (tab strip / toolbar), load the companion theme:
see `companion-dark-theme/README.md`.

---

## The new tab

Every new tab works like a phone home screen:

- **Live wallpaper** — one of 32 animated scenes behind everything.
- **Quick Links** — app-style shortcut tiles; click to open, press & hold to drag and rearrange on a grid.
- **Greeting** — an optional particle animation ("Good morning, _name_") on the first tab of each browser session.
- **Search** — type in the box and press **Enter**.
- **Gear icon** (bottom-right) — opens all settings.

---

## Settings

Open the gear (bottom-right). Five sections:

| Section | What it does |
|---------|--------------|
| **Backgrounds** | Change background — pick a **category** first, then a scene. Mark favorites. |
| **Display** | Header content (logo / clock / date), position (7-point picker), font, and text size. |
| **Widgets** | Quick Links: *Icon only*, *Text only*, *Use Theme Color*, *Open links in new tab*, and **+ Add link**. Press & hold a tile to rearrange. |
| **Animations** | Particle **greeting** (toggle + name), **Intensity** (density), **Quality** (render sharpness), **FPS** cap (30/60/120), **Speed**, and **Static mode**. |
| **Advanced Customization** | **Presets** — arrange widgets and toolbar for a background, then **Save Current Settings**. Each background can carry its own saved layout. |

---

## Backgrounds

| Category | Scenes |
|----------|--------|
| **Space** | Deep Space · Nebula Drift · Galaxy Spiral · Drift · Hyperspace · Meteor · Black Hole |
| **Nature** | Sakura · Fireflies · Bokeh · Snow · Ocean Light · Golden Hour · Windmill Field · Rainy Window · Lanterns · Fireside |
| **Passing By** | Bike Ride · Dog Walk · City Drive · Hot Air Balloon · Night Train |
| **Math** | Wave Surface · Torus Wave · Harmonic Sphere · Harmonic Surface · Maurer Rose · Möbius Strip |
| **Science** | Double Pendulum |
| **Interactive** | Point Sphere · Liquid Orb · Lens Illusion |

Scenes use a mix of Canvas 2D and WebGL (FBM / domain-warped shaders, particle systems,
parallax layers) with Canvas fallbacks where WebGL is unavailable.

---

## Performance notes

- One `requestAnimationFrame` loop; pauses when the tab is hidden.
- **Quality** controls render pixel-ratio — downscale for a smooth framerate on weaker
  machines, supersample for extra sharpness on strong ones.
- **Intensity** scales particle density; **FPS** caps the frame rate.
- Respects `prefers-reduced-motion`; **Static mode** freezes animation entirely.
- Resize is debounced; particle buffers rebuild cleanly.

---

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save background choice, display/animation settings, quick links, presets. |
| `search`  | Route the search box through your default search engine. |
| `favicon` | Show each Quick Link's site icon. |

No host permissions. No content scripts. No background service worker.

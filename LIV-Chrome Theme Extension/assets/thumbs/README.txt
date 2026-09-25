Optional grid-tile screenshots
==============================

Drop a screenshot here to use it as a background's grid thumbnail instead of the
auto-generated one. Wired in js/newtab.js (THUMB_IMG). If the file is missing,
LiV falls back to the generated tile, so this folder is entirely optional.

Recognised files (16:9, e.g. ~480x270 or larger, .jpg):
  smoke.jpg          - Smoke (pure CSS/SVG; can't be canvas-snapshotted, so a
                       screenshot is the only way to get a pixel-accurate tile)
  fractalTunnel.jpg  - Fractal Tunnel (its tile is already rendered for real from
                       the live WebGL2 scene; a screenshot here would override it)

To add another scene, add an entry to THUMB_IMG in js/newtab.js:
  <sceneKey>: 'assets/thumbs/<sceneKey>.jpg'

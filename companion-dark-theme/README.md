# Living New Tab — Dark Chrome (companion theme)

A pure Chrome theme that darkens the tab strip, toolbar, and frame to match the dark backgrounds of the **Liv** new tab extension.

---

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `companion-dark-theme` folder

That's it. The browser chrome will turn near-black immediately.

---

## Why is this a separate package?

Chrome does not allow a single package to be both a functional extension and a theme.
Extensions contain JavaScript; themes contain only color/image declarations.
Load both as separate items in `chrome://extensions`.

---

## Colors used

| Element | RGB |
|---------|-----|
| Frame (active / inactive) | `8, 8, 14` |
| Toolbar | `14, 14, 22` |
| NTP background | `6, 6, 12` |
| Tab text | `240, 240, 250` |
| Bookmark bar text | `210, 215, 228` |

---

## Icons

Replace `icons/icon128.png` with your own art when ready.

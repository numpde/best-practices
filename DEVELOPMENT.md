# Development

The wheel page is docs/index.html; the practices graph is docs/best-practices.html.

  make serve    Preview at http://127.0.0.1:8000/
  make check    Check graph data, local links, and privacy patterns.
  make check-browser    Check graph interactions in Chromium.

Preview needs Python 3; checks need Node.js 20+. Browser checks use chromium
on PATH, or the executable named by CHROMIUM. HEADED=1 uses a display and also
checks native background-tab behavior. CDP_PORT attaches to an open local
Chromium and leaves it running (requires Node.js 22+). Its temporary test tab
uses focus emulation unless HEADED=1; native visibility checks need a visible
window. Pushes to main publish docs/
to GitHub Pages. Research and design notes are in docs/notes/.

## Reusable logos

`docs/index.html` owns the colours, geometry, icons, and typography. Regenerate
the assets after changing its artwork; do not edit the exports directly.

```sh
make logos
make check-logos
```

Exporting requires Chromium and `pdftocairo` on PATH; `CHROMIUM` can select a
different browser executable. The check regenerates all six files and compares
their bytes. Use the same tool versions for reproducible exports.

| Artwork | SVG | PNG |
| --- | --- | --- |
| Full emblem | [ssdg-wheel.svg](assets/ssdg-wheel.svg) | [1600 × 1600](assets/ssdg-wheel.png) |
| Wordmark | [ssdg-wordmark.svg](assets/ssdg-wordmark.svg) | [1440 × 1092](assets/ssdg-wordmark.png) |
| Colour wheel | [ssdg-mark.svg](assets/ssdg-mark.svg) | [512 × 512](assets/ssdg-mark.png) |

All variants have transparent backgrounds. SVG lettering is outlined, so no
font installation or external resources are needed. Font licensing is retained
in the SVG metadata. Embed an SVG with an image element, or use PNG where SVG
is unsupported. The README uses the full emblem PNG.

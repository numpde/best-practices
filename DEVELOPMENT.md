# Development

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

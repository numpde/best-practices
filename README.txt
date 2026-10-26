Practices, connected
====================
https://numpde.github.io/best-practices/

The site and graph data live in docs/index.html. It is a standalone HTML file
with all runtime assets embedded and no build step.

  make serve    Preview at http://127.0.0.1:8000/
  make check    Check graph data, local links, and privacy patterns.

Preview needs Python 3; checks need Node.js 20+. Pushes to main publish docs/
to GitHub Pages. Research and design notes are in docs/notes/.

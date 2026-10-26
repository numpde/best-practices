Practices, connected
====================
An interactive graph of engineering patterns, anti-patterns, and their reasons.
The GitHub Pages site is the product:
  https://numpde.github.io/best-practices/

Source and ownership
--------------------
docs/index.html is the canonical application and graph source. The nodes and
edges arrays own concepts and relationships; generalityLevels owns their size
scale. Original public criteria and reviewed research summaries are embedded
as evidence. The bundled Cytoscape distribution includes its MIT notice.
There is no build step, package installation, CDN, or second generated HTML.
The page also opens directly from disk and works offline.

docs/notes/ contains public research-method and graph-design notes. Private
source conversations, session identifiers, workstation paths, and private
repository references are excluded from the public files and Git history.

Local work
----------
  make check       Validate graph data, local links, and publication privacy.
  make serve       Preview at http://127.0.0.1:8000/ (Python 3).
  make serve PORT=8080

Checks need Node.js 20 or later and use only its standard library. Add or edit
concepts in the embedded nodes array, including an explicit generality level.
Give each relationship a directional label and a meaningful explanation.
Run make check, then exercise the changed interaction in a browser. The check
validates data and publication boundaries; it does not prove visual usability.

Publishing
----------
GitHub Pages uses GitHub Actions. Pushes to main run the checks and publish only
docs/. Pull requests run the checks without publishing. The workflow may also
be run manually. Select GitHub Actions under Settings > Pages when setting up
a new repository. The workflow uses immutable official-action revisions.

Before public release, also run:
  node tools/check.mjs --history
This scans every reachable historical blob and commit message for the same
privacy patterns. Automated scanning supplements a human content review; it
cannot determine whether a seemingly ordinary example is confidential.

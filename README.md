# My System · A chess laboratory

An iPhone-friendly interactive edition of Aron Nimzowitsch’s **My System**, using Philip Hereford’s **1929 translation**. Read the book beside a board, replay the illustrative games, and try your own moves.

[Read the book online](https://yencarnacion.github.io/my-system/).

- All 15 chapters, front matter, and 50 illustrative games.
- All 237 diagrams, including the book’s conceptual and composite illustrations.
- 3,807 legally validated game half-moves, with original annotations and descriptive notation.
- 130 recovered chapter lines; 150 diagrams connect to a replay. Remaining illustrations display their positions and support manual exploration where playable.
- Inline passage players throughout all 15 chapters: follow prose examples without switching away from the text, including examples with no printed diagram. Moves have plain-English descriptions, highlighted squares, and arrows; alternatives have separate replays.
- Search, chapter and passage links, shareable replay positions, bookmarks, and local reading progress.
- Legal-move exploration, undo, board flipping, autoplay, and PGN/FEN export.
- Adjustable reading size, night mode, keyboard controls, responsive layouts, and offline caching.
- No runtime package installation, external CDN, account, analytics, database, or API key.

## Run locally

Node 20 or newer is sufficient. There are no npm dependencies to install.

```sh
npm start
```

Open `http://127.0.0.1:4173/`. To read on an iPhone on the same network:

```sh
HOST=0.0.0.0 npm start
```

Open `http://YOUR-COMPUTER-LAN-IP:4173/` on the phone. Offline caching requires HTTPS or localhost; a normal LAN HTTP address supports reading and replays but not the service worker.

## Build and host

```sh
npm run check
```

Upload **only `dist/`** to a static host. All assets and deep links work under a project subdirectory such as `/my-system/`. The build contains the 17 MB scan, but the reader downloads and caches only the application, book data, and piece assets until you open the PDF.

For GitHub Pages:

1. Copy the supplied `docs/workflows/pages.yml` template to `.github/workflows/pages.yml` and commit it. Use GitHub's web editor or a credential with permission to write workflows. Optionally install `check.yml` in the same directory for automatic validation.
2. In **Settings → Pages**, set the build source to **GitHub Actions**.
3. In **Actions**, run **Deploy to GitHub Pages** on `main`.
4. Use the URL returned by the deployment job.

The deployment workflow is deliberately manual. The templates are inert until installed; neither changes repository visibility. GitHub’s [current Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) describes availability for public and private repositories and the required settings. A private repository’s Pages eligibility depends on the account plan; this project does not change repository visibility.

## Reading and replay links

```text
#/library
#/read/pa01ch01
#/read/pa01ch01?section=pa01ch01-b14
#/read/pa01ch01?diagram=diagram_III&ply=4&view=board
#/read/pa01ch01?section=pa01ch01-b15&passage=pawnless-development&ply=8
#/read/game01?ply=17
#/study?diagram=diagram_III&ply=4
```

The `ply` parameter counts individual moves, starting at zero. Section IDs belong to the frozen source transcription. Preserve them or provide aliases when reorganizing content in a future edition.

Where a diagram has several recovered lines, use the line selector; shared links also preserve that choice.

For prose examples, select **Play this passage** beneath the paragraph. The inline board stays in the reading view, including on a phone. Step forward/back, jump to a move, or autoplay. The plain-English move description explains algebraic notation. The opening chapter’s “pawn-less” example also has editorial learning notes and arrows showing the pawn attacks; original book comments are labelled separately. **Try your own move** opens the full laboratory and preserves the book position.

## Source and proofreading

This is a **working transcription**, not a fully proofread critical edition. Legality checks ensure that replayed moves are possible, not that every printed word or historical game detail is correct. “Book score complete” means the moves printed in this edition, including its deliberately shortened game excerpts.

The old HTML supplies structure and annotations; the OCR and original scan provide comparison sources. Source-supported corrections are recorded explicitly. Schematic diagrams remain visible even when they are not legal chess positions. A diagram without a recovered book line supports manual exploration when it has a playable position.

See [the editorial record](docs/editorial.md), [validation notes](docs/validation.md), and [third-party notices](public/THIRD-PARTY-NOTICES.txt).

## Repository layout

```text
public/                 Portable application and generated book data
  source/               Original 1929 PDF
  pieces/               Locally served, attributed SVG chess pieces
  vendor/               Pinned chess.js distribution and license
sources/                Sanitized transcription, OCR, correction ledgers
scripts/                Import, validation, build, and preview tools
tests/                  Content integrity and browser interaction checks
docs/                   Editorial and validation documentation
```

The original workspace’s IDE files, old executable scripts, binaries, personal TODOs, machine paths, and instruction file were excluded from this repository. The supplied image-heavy Markdown remains in the original workspace; its text counterpart is retained here as `sources/ocr.txt`.

## Regenerate the book data

The normal build uses the checked-in data and needs only Node. For editorial work, install the small Python import dependency in a virtual environment:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-import.txt
.venv/bin/python scripts/extract.py
node scripts/compile.mjs
npm run check
```

The importer never evaluates the legacy JavaScript-like `parameters` attributes. It extracts a limited set of strings and renders allowlisted markup. Every correction records what changed and why; the uncorrected source prose remains available for comparison.

For the optional real-browser checks, install Python Playwright and Chromium, set `CHROME_PATH` if needed, then run:

```sh
npm run build
node scripts/browser-check.mjs
```

Screenshots and browser results are written to ignored `test-results/`.

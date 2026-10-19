# Validation

Run `npm run check` for source integrity, legal replay, and a production build. Run `node scripts/browser-check.mjs` after building for the optional Chromium checks.

## Content

- 69 reading units: 15 chapters, 50 games, and four front-matter units.
- 237 distinct diagrams with valid eight-by-eight placements.
- 50 book scores and 3,807 half-moves replayed through chess.js 1.4.0.
- 130 chapter lines and 1,742 additional half-moves, each checked for legality and an exact match to its diagram. In total, 150 diagrams have attached replays.
- Every generated frame checked against a fresh replay, including side, move number, origin, destination, and full FEN.
- Linked game diagrams checked against the precise stored game position.
- Schematic illustrations preserved without invented kings.
- Missing moves, corrected piece placements, and Game 49’s excerpt boundary covered by regression checks.
- Imported reader HTML checked for executable tags, event handlers, and JavaScript links.
- Passage replays checked for exact source-block links, legal starting positions and moves, matching FENs, and verbatim quoted comments. Coverage checks require replay cards in all 15 main chapters.
- The opening “pawn-less” example checks both the d5 pawn’s attack on the c4 bishop and the d4 pawn’s attack on the c3 knight.

## Browser

Automated checks use real Chromium at 1440px, iPhone-like 390px, and narrow 320px widths. They exercise replay, keyboard stepping, board flipping, legal exploration and undo, PGN export, deep-link reload, search, bookmarks, persistent reading settings, denied local storage, and offline reload. Promotion choices, source-line switching, and preservation of the reading position are covered too. The server uses `/my-system/` to verify project-subdirectory hosting.

An optional axe-core run checks the sampled desktop reader and mobile board against WCAG A/AA rules; no violations remain in these sampled views. This is not a complete accessibility certification.

The inline passage player is checked on desktop and phone: step controls, move descriptions and piece placement, switching between alternatives, shared-position reload, exploration/return, and remaining in the reading view. The mobile passage player is included in the sampled axe checks.

Screenshots were visually reviewed for desktop and phone reading and board layouts. No horizontal page overflow or JavaScript exceptions were observed in the tested flows. Chromium device emulation is not a physical iPhone/Safari certification; a Safari pass on a real device remains useful.

## Privacy and portability

The build serves only `public/`. No environment variables, API credentials, local instruction files, IDE metadata, or original executable legacy scripts are shipped. SVG assets and chess.js are local and attributed. The PDF has no custom metadata, JavaScript, or forms. Browser storage contains only reading preferences, progress, and bookmarks.

The app’s network traffic is limited to its static assets and separately requested PDF, plus external source links a reader explicitly opens. No telemetry is added. The service worker excludes the large PDF from its offline cache.

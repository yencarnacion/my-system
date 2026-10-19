import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Chess, DEFAULT_POSITION } from "../public/vendor/chess.mjs";
import {
  candidates,
  resolveSequence,
  scoreLine,
} from "../scripts/descriptive.mjs";
const book = JSON.parse(
  fs.readFileSync(new URL("../public/data/book.json", import.meta.url)),
);
test("Complete source inventory and unique stable IDs", () => {
  assert.equal(book.chapters.length, 69);
  assert.equal(book.chapters.filter((c) => c.group === "games").length, 50);
  assert.equal(book.diagrams.length, 237);
  const ids = book.chapters.flatMap((c) => c.blocks.map((b) => b.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(book.stats.words > 100000);
  for (const d of book.diagrams) {
    assert.equal(d.placement.split("/").length, 8, d.id);
    for (const r of d.placement.split("/"))
      assert.equal(
        [...r].reduce((n, p) => n + (/\d/.test(p) ? +p : 1), 0),
        8,
        d.id,
      );
    assert.ok(ids.includes(d.block), d.id);
  }
});
test("All 50 book scores replay legally and every stored FEN agrees", () => {
  let count = 0;
  for (const g of Object.values(book.games)) {
    assert.equal(g.complete, true, g.id);
    assert.equal(g.moves.length, g.total, g.id);
    const chess = new Chess(g.start);
    for (const m of g.moves) {
      assert.equal(chess.turn(), m.side, g.id);
      assert.equal(chess.moveNumber(), m.number, g.id);
      const move = chess.move(m.san);
      assert.equal(move.from, m.from);
      assert.equal(move.to, m.to);
      assert.equal(chess.fen(), m.fen, `${g.id} ${m.number}${m.side}`);
      count++;
    }
  }
  assert.equal(count, 3807);
});
test("Linked diagrams agree with their exact game positions", () => {
  for (const d of book.diagrams.filter((d) => d.game)) {
    assert.equal(
      book.games[d.game].moves[d.gamePly - 1].fen.split(" ")[0],
      d.placement,
      d.id,
    );
  }
});
test("Guided chapter lines preserve validated positions", () => {
  for (const d of book.diagrams)
    for (const l of d.lines) {
      const c = new Chess(l.start);
      for (const m of l.moves) {
        c.move(m.san);
        assert.equal(c.fen(), m.fen);
      }
      assert.ok(l.diagramPly >= 0, l.id);
      assert.equal(
        [l.start, ...l.moves.map((m) => m.fen)][l.diagramPly].split(" ")[0],
        d.placement,
        l.id,
      );
      if (l.kind === "chapter") assert.ok(l.note, l.id);
    }
});
test("Chapter examples have broad, source-recorded replay coverage", () => {
  assert.ok(book.stats.chapterLines >= 100);
  assert.ok(book.stats.replayableDiagrams >= 140);
  const ids = book.diagrams.flatMap((d) => d.lines.map((l) => l.id));
  assert.equal(new Set(ids).size, ids.length);
});
test("Corrections restore missing score and preserve provenance", () => {
  assert.equal(
    book.games.game02.moves.filter((m) => m.number >= 16 && m.number <= 23)
      .length,
    16,
  );
  assert.equal(
    book.games.game07.moves.find((m) => m.number === 12 && m.side === "w").san,
    "gxf3",
  );
  assert.equal(
    book.diagrams
      .find((d) => d.id === "diagram_CCXVII")
      .placement.split("/")
      .at(-1),
    "R1B1N1K1",
  );
  assert.ok(
    book.games.game11.moves.find((m) => m.number === 2 && m.side === "w")
      .correction,
  );
});
test("Excerpt Game 49 stops before the unrelated comparison games", () => {
  assert.equal(book.games.game49.moves.length, 39);
  assert.equal(book.games.game49.moves.at(-1).san, "Bf5");
});
test("Schematic illustrations are retained without inventing kings", () => {
  for (const id of ["diagram_I", "diagram_II", "diagram_CXLIX"])
    assert.equal(book.diagrams.find((d) => d.id === id).playable, false);
});
test("Imported reader markup is inert and contains no legacy scripts", () => {
  for (const c of book.chapters)
    for (const b of c.blocks) {
      assert.doesNotMatch(
        b.html || "",
        /<\s*(?:script|style|iframe|object|embed|form)\b|\son\w+\s*=|javascript:/i,
      );
    }
});
test("Descriptive notation converts moves with alternating perspectives", () => {
  const r = resolveSequence(
    ["1. P-K4, P-Q4", "2. PxP, QxP", "3. Kt-QB3"].flatMap(scoreLine),
    DEFAULT_POSITION,
  );
  assert.equal(r.complete, true);
  assert.deepEqual(
    r.moves.map((m) => m.san),
    ["e4", "d5", "exd5", "Qxd5", "Nc3"],
  );
});
test("Reject missing move numbers, illegal moves and ambiguous unfinished sources", () => {
  assert.equal(
    resolveSequence(scoreLine("2. P-K4, P-K4"), DEFAULT_POSITION).moves.length,
    0,
  );
  assert.equal(candidates(new Chess(), "R-K4").length, 0);
  assert.equal(scoreLine("1. P-K4, P-K4, and then Black attacks"), null);
});
test("Game 20 reuses the book’s referenced opening rather than starting at move 15", () => {
  assert.equal(
    book.games.game20.moves[27].fen,
    book.games.game19.moves[27].fen,
  );
  assert.equal(book.games.game20.moves[28].number, 15);
});
test("Every legacy reader link has a resolvable target", () => {
  const ids = new Set(book.chapters.map((c) => c.id));
  const blocks = new Set(
    book.chapters.flatMap((c) => c.blocks.map((b) => b.id)),
  );
  for (const c of book.chapters)
    for (const b of c.blocks) {
      for (const match of (b.html || "").matchAll(/href="#([^"]+)"/g)) {
        const id = match[1].replace(/^game(\d)$/, "game0$1");
        assert.ok(ids.has(id) || book.aliases[id], id);
      }
    }
  for (const [id, a] of Object.entries(book.aliases)) {
    assert.ok(ids.has(a.chapter), id);
    if (a.block) assert.ok(blocks.has(a.block), `${id}: ${a.block}`);
  }
});
test("Split-board teaching lines are preserved", () => {
  assert.equal(
    book.diagrams.find((d) => d.id === "diagram_II").strokes.length,
    4,
  );
  assert.ok(
    book.diagrams.find((d) => d.id === "diagram_XLVIII").strokes.length,
  );
});

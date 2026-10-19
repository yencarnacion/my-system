import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Chess, DEFAULT_POSITION } from "../public/vendor/chess.mjs";
import { normalize, scoreLine, resolveSequence } from "./descriptive.mjs";
import { compilePassages } from "./passages.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const book = JSON.parse(
  fs.readFileSync(path.join(root, "sources/extracted.json"), "utf8"),
);
const corrections = JSON.parse(
  fs.readFileSync(path.join(root, "sources/corrections.json"), "utf8"),
);
Object.assign(
  corrections.moves,
  JSON.parse(
    fs.readFileSync(path.join(root, "sources/audit-move-fixes.json"), "utf8"),
  ),
);
const diagramFixFile = path.join(root, "sources/audit-diagram-fixes.json");
if (fs.existsSync(diagramFixFile))
  Object.assign(
    corrections.diagrams,
    JSON.parse(fs.readFileSync(diagramFixFile, "utf8")),
  );
const additions = JSON.parse(
  fs.readFileSync(path.join(root, "sources/audit-additions.json"), "utf8"),
);
const tokensBy = {};
const report = { games: [], diagrams: [], corrections };
const games = {};
for (const c of book.chapters.filter((c) => c.group === "games")) {
  let tokens = [];
  for (const b of c.blocks) {
    const add = additions.find((a) => a.block === b.id);
    const lines = add ? add.score.split(";") : [b.text];
    let added = false;
    for (const raw of lines) {
      const line = scoreLine(raw);
      if (line?.length) {
        added = true;
        for (const t of line) {
          if (
            c.id === "game45" &&
            t.number === 37 &&
            t.side === "b" &&
            /Q.?KR5/.test(normalize(t.original))
          )
            t.number = 36;
          const key = `${c.id}:${t.number}${t.side}`;
          const fix = corrections.moves[key];
          if (fix) {
            t.sourceOriginal = t.original;
            t.original = fix.move;
            t.correction = fix.note;
          }
          tokens.push({ ...t, block: b.id, comment: "" });
        }
        if (
          c.id === "game02" &&
          line.at(-1).number === 15 &&
          line.at(-1).side === "b"
        ) {
          const missing = [
            "Q-Q2, QR-Q1",
            "KR-K1, B-B1",
            "QR-Q1, Kt-Q2",
            "Kt-B5, Kt-K4",
            "Kt-Q4, P-KB3",
            "K-R1, Q-KB2",
            "Q-KB2, Q-Kt3",
            "P-QKt3, Kt-B2",
          ];
          missing.forEach((m, i) =>
            tokens.push(
              ...scoreLine(`${i + 16}. ${m}`).map((t) => ({
                ...t,
                block: b.id,
                comment: "Moves restored from the 1929 scan, printed page 230.",
              })),
            ),
          );
        }
      }
    }
    if (
      tokens.length &&
      b.type !== "diagram" &&
      (!added || (add && b.text.length > add.score.length + 35))
    )
      tokens.at(-1).comment += (tokens.at(-1).comment ? "\n\n" : "") + b.text;
  }
  if (c.id === "game20")
    tokens = [
      ...tokensBy.game19
        .filter((t) => t.number <= 14)
        .map((t) => ({
          ...t,
          block: c.blocks[0].id,
          comment:
            "The book refers to Game 19 for the first fourteen moves (with a transposition).",
        })),
      ...tokens,
    ];
  // Game 49 is an excerpt followed by unrelated comparison games.
  if (c.id === "game49")
    tokens = tokens.slice(
      0,
      tokens.findIndex((t) => t.number === 20 && t.side === "w") + 1,
    );
  tokensBy[c.id] = tokens;
  const result = resolveSequence(tokens, DEFAULT_POSITION, 100000);
  games[c.id] = {
    id: c.id,
    title: c.title,
    start: DEFAULT_POSITION,
    moves: result.moves,
    complete: result.complete,
    total: tokens.length,
    failed: result.failed,
  };
  c.game = c.id;
  report.games.push({
    id: c.id,
    moves: result.moves.length,
    total: tokens.length,
    complete: result.complete,
    failed: result.failed,
    fen: result.moves.at(-1)?.fen,
  });
}
for (const d of book.diagrams) {
  if (corrections.diagrams[d.id]) {
    const fix = corrections.diagrams[d.id];
    if (fix.placement) {
      d.originalPlacement = d.placement;
      d.placement = fix.placement;
    }
    if (fix.caption) {
      d.originalCaption = d.caption;
      d.caption = fix.caption;
    }
    d.correction = fix.note;
  }
  const c = book.chapters.find((c) => c.id === d.chapter);
  const index = c.blocks.findIndex((b) => b.diagram === d.id);
  d.context = c.blocks
    .slice(Math.max(0, index - 1), index + 3)
    .filter((b) => b.type !== "diagram")
    .map((b) => b.text)
    .join("\n\n");
  d.block = c.blocks[index]?.id;
  d.scanPage = Math.floor(d.page / 2) + 8;
  d.lines = [];
  const game = games[d.chapter];
  if (game) {
    const at = game.moves.findIndex((m) => m.fen.split(" ")[0] === d.placement);
    if (at >= 0) {
      d.game = game.id;
      d.gamePly = at + 1;
      d.fen = game.moves[at].fen;
    }
  }
  if (!d.fen) {
    const after = d.caption.match(/after\s+(White|Black)'?s?\s*(\d+)/i);
    let turn = after
      ? after[1].toLowerCase() === "white"
        ? "b"
        : "w"
      : /black\s+to\s+(?:play|move)/i.test(d.caption)
        ? "b"
        : "w";
    let number = after ? +after[2] + (turn === "w" ? 1 : 0) : 1;
    d.fen = `${d.placement} ${turn} - - 0 ${number}`;
    d.turnInferred = !after && !/to\s+(?:play|move)/i.test(d.caption);
  }
  try {
    new Chess(d.fen);
    d.playable = true;
  } catch {
    d.playable = false;
  }
  report.diagrams.push({
    id: d.id,
    playable: d.playable,
    game: d.game || null,
  });
}
// Short introductory lines explicitly present in the text, with editorial teaching cues.
const guided = [
  {
    id: "tempo",
    diagram: "diagram_III",
    title: "Develop with a threat",
    start: DEFAULT_POSITION,
    san: ["e4", "d5", "exd5", "Qxd5", "Nc3"],
    comments: [
      "Occupy the centre and open lines for the bishop and queen.",
      "Black challenges the centre immediately.",
      "The exchange invites Black’s queen into the centre.",
      "The queen recaptures, becoming a target.",
      "The knight develops and attacks the queen. Black must spend another move on a piece already developed. This is a gain of tempo.",
    ],
    prompt:
      "After the queen recaptures, how can White develop a piece with a threat?",
    answerPly: 5,
  },
  {
    id: "exchange-tempo",
    diagram: "diagram_IV",
    title: "Invite a target, then attack it",
    start: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    san: ["exd5", "Qxd5", "Nc3"],
    comments: [
      "First entice the recapturing piece onto an exposed square.",
      "The queen is now on d5.",
      "Develop the knight while attacking the queen. Exchange and development work together.",
    ],
    prompt: "Why exchange pawns before developing the knight?",
    answerPly: 3,
  },
];
for (const l of guided) {
  const chess = new Chess(l.start);
  l.moves = l.san.map((san, i) => {
    const color = chess.turn(),
      number = chess.moveNumber();
    const m = chess.move(san);
    return {
      san: m.san,
      from: m.from,
      to: m.to,
      fen: chess.fen(),
      side: color,
      number,
      comment: l.comments[i],
      original: "",
      editorial: true,
    };
  });
  delete l.san;
  delete l.comments;
  const d = book.diagrams.find((d) => d.id === l.diagram);
  l.kind = "guided";
  l.diagramPly = [l.start, ...l.moves.map((m) => m.fen)].findIndex(
    (f) => f.split(" ")[0] === d.placement,
  );
  d.lines.push(l);
}
const chapterLines = JSON.parse(
  fs.readFileSync(path.join(root, "sources/chapter-lines.json"), "utf8"),
);
for (const sourceLine of chapterLines) {
  const d = book.diagrams.find((d) => d.id === sourceLine.diagram);
  if (!d) throw Error("Unknown diagram for chapter line: " + sourceLine.id);
  const chess = new Chess(sourceLine.start);
  const moves = sourceLine.moves.map((san, i) => {
    const side = chess.turn(),
      number = chess.moveNumber();
    const m = chess.move(san);
    return {
      san: m.san,
      from: m.from,
      to: m.to,
      fen: chess.fen(),
      side,
      number,
      comment: sourceLine.comments?.[i] || "",
      editorial: !!sourceLine.editorial,
    };
  });
  const frames = [sourceLine.start, ...moves.map((m) => m.fen)];
  const diagramPly = frames.findIndex((f) => f.split(" ")[0] === d.placement);
  if (diagramPly < 0)
    throw Error(`Chapter line ${sourceLine.id} never reaches its diagram.`);
  d.lines.push({
    id: sourceLine.id,
    title: sourceLine.title,
    start: sourceLine.start,
    moves,
    diagramPly,
    kind: sourceLine.editorial ? "guided" : "chapter",
    note: sourceLine.note.replace(/\s+/g, " ").trim(),
  });
}
// Put a continuation from the actual diagram before an opening that only leads to it.
for (const d of book.diagrams)
  d.lines.sort(
    (a, b) =>
      Number(b.kind === "guided") - Number(a.kind === "guided") ||
      Number(a.diagramPly === a.moves.length) -
        Number(b.diagramPly === b.moves.length),
  );
book.games = games;
const passageStats = compilePassages(book, root);
book.stats = {
  chapters: 15,
  games: 50,
  diagrams: book.diagrams.length,
  words: book.chapters.reduce((n, c) => n + c.wordCount, 0),
  replayMoves: Object.values(games).reduce((n, g) => n + g.moves.length, 0),
  completeGames: Object.values(games).filter((g) => g.complete).length,
  chapterLines: chapterLines.length,
  chapterReplayMoves: chapterLines.reduce((n, l) => n + l.moves.length, 0),
  replayableDiagrams: book.diagrams.filter((d) => d.lines.length || d.game)
    .length,
  ...passageStats,
};
report.passages = Object.values(book.passages).map(
  ({ id, chapter, block, moves }) => ({
    id,
    chapter,
    block,
    moves: moves.length,
  }),
);
report.chapterLines = chapterLines.map((l) => ({
  id: l.id,
  diagram: l.diagram,
  moves: l.moves.length,
}));
fs.writeFileSync(
  path.join(root, "public/data/book.json"),
  JSON.stringify(book),
);
fs.writeFileSync(
  path.join(root, "sources/import-report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(book.stats);
console.log(
  "Incomplete score imports:",
  report.games
    .filter((g) => !g.complete)
    .map(
      (g) =>
        `${g.id}: ${g.moves}/${g.total}; ${g.failed?.number}${g.failed?.side} ${g.failed?.original}`,
    )
    .join("\n"),
);

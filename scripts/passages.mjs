import fs from "node:fs";
import path from "node:path";
import { Chess, DEFAULT_POSITION } from "../public/vendor/chess.mjs";

// Explicit source links keep a legal line attached to the passage it explains.
// Legality alone is never used to guess which nearby paragraph a line belongs to.
export function compilePassages(book, root) {
  const read = (name) => {
    const file = path.join(root, "sources", name);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  };
  const passages = {};
  const blocks = new Map(
    book.chapters.flatMap((c) => c.blocks.map((b) => [b.id, { c, b }])),
  );
  const chapterLines = new Map(
    book.diagrams.flatMap((d) => d.lines.map((l) => [l.id, { d, l }])),
  );
  const add = (source) => {
    if (passages[source.id])
      throw Error("Duplicate passage replay: " + source.id);
    const linked = [...new Set([source.block, ...(source.blocks || [])])];
    const entry = blocks.get(source.block);
    if (!entry || entry.c.id !== source.chapter)
      throw Error("Invalid passage source: " + source.id);
    const chess = new Chess(source.start);
    const moves = source.moves.map((move, i) => {
      const number = chess.moveNumber(),
        side = chess.turn();
      const m = chess.move(typeof move === "string" ? move : move.san);
      const existing = typeof move === "object" ? move : {};
      return {
        ...existing,
        san: m.san,
        from: m.from,
        to: m.to,
        piece: m.piece,
        captured: m.captured || null,
        promotion: m.promotion || null,
        number,
        side,
        fen: chess.fen(),
        original: source.originalMoves?.[i] || existing.original || "",
        comment: source.comments?.[i] || existing.comment || "",
        studyNote: source.studyNotes?.[i] || "",
        arrows: source.arrows?.[i] || [],
      };
    });
    const context = linked
      .map((id) => {
        const item = blocks.get(id);
        if (!item || item.c.id !== source.chapter || item.b.type === "diagram")
          throw Error("Invalid passage block: " + id);
        (item.b.passages ||= []).push(source.id);
        return item.b.text;
      })
      .join("\n\n");
    passages[source.id] = {
      id: source.id,
      title: source.title,
      chapter: source.chapter,
      block: source.block,
      blocks: linked,
      start: source.start,
      moves,
      context,
      note: source.note.replace(/\s+/g, " ").trim(),
      kind: "passage",
      sourceDiagram: source.sourceDiagram || null,
      startLabel:
        source.start === DEFAULT_POSITION
          ? "From the starting position"
          : `From the book position · move ${source.start.split(" ")[5]}, ${source.start.split(" ")[1] === "w" ? "White" : "Black"} to move`,
    };
  };
  for (const link of read("passage-links.json")) {
    const found = chapterLines.get(link.line);
    if (!found) throw Error("Unknown linked chapter line: " + link.line);
    const { d, l } = found;
    add({
      ...l,
      id: "passage-" + l.id,
      chapter: d.chapter,
      block: link.block,
      blocks: link.blocks,
      sourceDiagram: d.id,
      title:
        l.title === "Opening to the diagram"
          ? `How the position in ${d.label} arises`
          : l.title,
    });
  }
  for (const source of [
    ...read("teaching-lines.json"),
    ...read("passage-lines.json"),
  ])
    add(source);
  book.passages = passages;
  return {
    passageLines: Object.keys(passages).length,
    passageBlocks: [...blocks.values()].filter(({ b }) => b.passages?.length)
      .length,
    passageChapters: new Set(Object.values(passages).map((l) => l.chapter))
      .size,
    passageMoves: Object.values(passages).reduce(
      (n, l) => n + l.moves.length,
      0,
    ),
  };
}

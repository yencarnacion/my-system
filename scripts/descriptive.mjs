import { Chess } from "../public/vendor/chess.mjs";

export function normalize(text) {
  return text
    .replace(/[—–−]/g, "-")
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const files = {
  QR: "a",
  QKT: "b",
  QB: "c",
  Q: "d",
  K: "e",
  KB: "f",
  KKT: "g",
  KR: "h",
  R: "ah",
  KT: "bg",
  B: "cf",
};
const piece = { P: "p", R: "r", KT: "n", B: "b", Q: "q", K: "k" };
function squares(token, color) {
  const m = token.match(/^(QR|QKT|QB|Q|KKT|KR|KB|K|KT|R|B)([1-8])$/);
  return m
    ? [...files[m[1]]].map((f) => f + (color === "w" ? m[2] : 9 - Number(m[2])))
    : [];
}
function birthSquare(chess, square) {
  let current = square;
  for (const m of chess.history({ verbose: true }).reverse()) {
    if (m.to === current) current = m.from;
    else if (m.flags.includes("k") && current === `f${m.color === "w" ? 1 : 8}`)
      current = `h${m.color === "w" ? 1 : 8}`;
    else if (m.flags.includes("q") && current === `d${m.color === "w" ? 1 : 8}`)
      current = `a${m.color === "w" ? 1 : 8}`;
  }
  return current;
}
function originMatches(spec, move, color, chess) {
  if (piece[spec]) return move.piece === piece[spec];
  let m = spec.match(/^(QR|QKT|QB|Q|KKT|KR|KB|K|KT|R|B)P$/);
  if (m) return move.piece === "p" && files[m[1]].includes(move.from[0]);
  m = spec.match(/^(Q|K)(R|KT|B)$/);
  if (m)
    return (
      move.piece === piece[m[2]] &&
      (m[1] === "Q"
        ? { R: "a", KT: "b", B: "c" }
        : { R: "h", KT: "g", B: "f" })[m[2]] ===
        birthSquare(chess, move.from)[0]
    );
  m = spec.match(/^(R|KT|B|Q|K|P)\(([^)]+)\)$/);
  if (m)
    return (
      move.piece === piece[m[1]] &&
      (squares(m[2], color).includes(move.from) ||
        (files[m[2]] || "").includes(move.from[0]))
    );
  return false;
}
export function candidates(chess, original) {
  let t = normalize(original)
    .toUpperCase()
    .replace(/\s*(DBL\.?\s*)?CH(?:ECK)?\.?/g, "")
    .replace(/MATE|[!?+#†‡]/g, "")
    .replace(/E\.P\.|DOUBLE/g, "")
    .replace(/\s+/g, "")
    .replace(/[.;,]+$/, "");
  if (/^([O0]-){1,2}[O0]$/.test(t))
    return chess
      .moves({ verbose: true })
      .filter((m) => m.san.replace(/[+#]/g, "") === t.replace(/0/g, "O"));
  const promotion = t.match(/(?:=|\()(Q|R|B|KT)\)?$/);
  if (promotion) t = t.slice(0, promotion.index);
  const match = t.match(/^(.+?)(-|X|×)(.+)$/);
  if (!match) return [];
  const [, from, op, to] = match;
  return chess.moves({ verbose: true }).filter((m) => {
    if (!originMatches(from, m, chess.turn(), chess)) return false;
    if (promotion && m.promotion !== piece[promotion[1]]) return false;
    if (!promotion && m.promotion && m.promotion !== "q") return false;
    if (op === "-" && m.captured) return false;
    if (op !== "-" && !m.captured) return false;
    const dest = squares(to, chess.turn());
    if (dest.length) return dest.includes(m.to);
    if (piece[to]) return m.captured === piece[to];
    if (/^(Q|K)(R|KT|B)$/.test(to)) return m.captured === piece[to.slice(1)];
    const located = to.match(/^(P|R|KT|B|Q|K)\(([^)]+)\)$/);
    if (located)
      return (
        m.captured === piece[located[1]] &&
        squares(located[2], chess.turn() === "w" ? "b" : "w").includes(m.to)
      );
    const victim = to.match(/^(QR|QKT|QB|Q|KKT|KR|KB|K|KT|R|B)P$/);
    return !!victim && m.captured === "p" && files[victim[1]].includes(m.to[0]);
  });
}
export function scoreLine(text) {
  const t = normalize(text);
  // Only standalone numbered score lines, never an annotation's embedded variation.
  const m = t.match(/^(\d+)\.\s*(.{1,95})$/);
  if (!m) return null;
  let rest = m[2].replace(/\s*\((?:\d+)\)\s*$/, "");
  if (/resigns|drawn|draw\b|wins|White|Black/i.test(rest)) return null;
  const halves = rest.split(/,\s*/);
  if (halves.length > 2) return null;
  const plausible = (x) =>
    /^\.*\s*$/.test(x) ||
    (/^(?:[KQRBP]|[O0]-)/i.test(x) &&
      !/\b(?:the|and|with|or|if|which|after|but)\b/i.test(x));
  if (!halves.every(plausible)) return null;
  let white = halves[0],
    black = halves[1];
  if (/^\.{2,}\s*[^.]/.test(white)) {
    black = white.replace(/^\.+\s*/, "");
    white = "....";
  }
  const result = [];
  for (const [side, v] of [
    ["w", white],
    ["b", black],
  ])
    if (v && !/^\.*$/.test(v.trim()))
      result.push({ number: +m[1], side, original: v.trim() });
  return result;
}
export function resolveSequence(tokens, fen, maxBranches = 2000) {
  let visits = 0,
    best = [];
  function visit(chess, i, path) {
    if (path.length > best.length) best = path;
    if (i >= tokens.length || ++visits > maxBranches)
      return i >= tokens.length ? path : null;
    const t = tokens[i];
    if (t.side && chess.turn() !== t.side) return null;
    if (t.number && Number(chess.fen().split(" ")[5]) !== t.number) return null;
    for (const m of candidates(chess, t.original)) {
      const moved = chess.move(m);
      const r = visit(chess, i + 1, [
        ...path,
        {
          ...t,
          san: moved.san,
          from: moved.from,
          to: moved.to,
          fen: chess.fen(),
        },
      ]);
      chess.undo();
      if (r) return r;
    }
    return null;
  }
  const complete = visit(new Chess(fen), 0, []);
  return {
    moves: complete || best,
    complete: !!complete,
    failed: tokens[(complete || best).length] || null,
  };
}

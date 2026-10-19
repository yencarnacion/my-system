const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const names = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export function describeMove(move) {
  const who = move.side === "w" ? "White" : "Black";
  if (move.san.startsWith("O-O"))
    return `${who} castles ${move.san.startsWith("O-O-O") ? "queenside" : "kingside"}: king ${move.from} → ${move.to}.`;
  return `${who} ${names[move.piece]}: ${move.from} → ${move.to}${move.captured ? `, capturing a ${names[move.captured]}` : ""}${move.promotion ? ` and promoting to a ${names[move.promotion]}` : ""}.${move.san.endsWith("#") ? " Checkmate." : move.san.endsWith("+") ? " Check." : ""}`;
}

export function passageChoices(block, book, icon) {
  if (!block.passages?.length) return "";
  return `<section class="passage-replays" aria-label="Replay this passage"><p class="passage-invitation">${icon("play")} Follow this passage on a board</p><div class="passage-options">${block.passages
    .map((id) => {
      const l = book.passages[id];
      return `<button class="passage-choice" data-open-passage="${id}" aria-expanded="false"><span>${esc(l.title)}</span><small>${l.moves.length} steps · ${esc(l.startLabel)}</small><b>Play this passage →</b></button>`;
    })
    .join("")}</div><div class="passage-slot"></div></section>`;
}

function board(line, ply, flipped) {
  const frame = line.moves[ply - 1],
    fen = frame?.fen || line.start;
  const placement = fen
    .split(" ")[0]
    .split("/")
    .flatMap((rank) =>
      [...rank].flatMap((c) => (/\d/.test(c) ? Array(+c).fill(null) : [c])),
    );
  const coords = (sq) => {
    const x = sq.charCodeAt(0) - 97 + 0.5,
      y = 8 - Number(sq[1]) + 0.5;
    return flipped ? [8 - x, 8 - y] : [x, y];
  };
  const arrow = (from, to, threat = false) => {
    const a = coords(from),
      b = coords(to);
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${threat ? "threat-arrow" : "move-arrow"}" marker-end="url(#${threat ? "threat" : "move"}-arrowhead)"/>`;
  };
  const squares = Array.from({ length: 64 }, (_, display) => {
    const i = flipped ? 63 - display : display,
      file = String.fromCharCode(97 + (i % 8)),
      rank = 8 - Math.floor(i / 8),
      sq = file + rank,
      p = placement[i];
    return `<span class="inline-square ${(Math.floor(i / 8) + (i % 8)) % 2 ? "dark" : "light"} ${frame && [frame.from, frame.to].includes(sq) ? "last" : ""}" data-inline-square="${sq}">${p ? `<img src="./pieces/${p === p.toUpperCase() ? "w" : "b"}${p.toLowerCase()}.svg" alt="" draggable="false">` : ""}${display % 8 === 0 ? `<span class="coord">${rank}</span>` : ""}${display >= 56 ? `<span class="coord file">${file}</span>` : ""}</span>`;
  }).join("");
  return `<div class="inline-board" role="img" aria-label="Chess position ${frame ? `after ${frame.number}${frame.side === "b" ? " black" : " white"}: ${esc(describeMove(frame))}` : "at the start of this passage"}">${squares}<svg class="inline-arrows" viewBox="0 0 8 8" aria-hidden="true"><defs><marker id="move-arrowhead" markerWidth="3" markerHeight="3" refX="2.4" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 Z"/></marker><marker id="threat-arrowhead" markerWidth="3" markerHeight="3" refX="2.4" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 Z"/></marker></defs>${frame ? arrow(frame.from, frame.to) : ""}${(frame?.arrows || []).map(([a, b]) => arrow(a, b, true)).join("")}</svg></div>`;
}

export function passagePlayer(line, ply, flipped, playing, exploring, icon) {
  const m = line.moves[ply - 1];
  const action = (name, label, disabled = false) =>
    `<button data-inline-action="${name}" aria-label="${label}" ${disabled ? "disabled" : ""}>${icon(name === "play" && playing ? "pause" : name)}</button>`;
  return `<div id="passage-player" class="passage-player" aria-label="Passage chess player"><div class="inline-player-head"><p><strong>${esc(line.title)}</strong><span>${ply ? `${m.number}${m.side === "w" ? "." : "…"} ${esc(m.san)}` : "Starting position"} · Step ${ply} of ${line.moves.length}</span></p><button class="icon-button" data-inline-action="flip" aria-label="Flip passage board">${icon("flip")}</button></div>${board(line, ply, flipped)}<div class="inline-controls" role="group" aria-label="Passage replay controls">${action("first", "Restart passage", ply === 0 || exploring)}${action("prev", "Previous passage move", ply === 0 || exploring)}${action("play", playing ? "Pause passage" : "Play passage automatically", exploring)}${action("next", "Next passage move", ply === line.moves.length || exploring)}${action("last", "Last passage move", ply === line.moves.length || exploring)}</div><div class="inline-explanation" aria-live="polite" aria-atomic="true"><p class="plain-move">${m ? esc(describeMove(m)) : "Start here. Tap the right arrow to follow one move at a time."}</p>${m?.original ? `<p class="inline-original">In the book: <strong>${esc(m.original)}</strong></p>` : ""}${m?.studyNote ? `<p class="inline-note"><span class="annotation-label">Learning note · editorial</span>${esc(m.studyNote)}</p>` : ""}${m?.comment ? `<blockquote><span class="annotation-label">From the book</span>${esc(m.comment)}</blockquote>` : ""}</div><div class="inline-moves" aria-label="Jump to a move in this passage"><button data-passage-ply="0" ${ply === 0 ? 'aria-current="step"' : ""} ${exploring ? "disabled" : ""}>Start</button>${line.moves.map((m, i) => `<button data-passage-ply="${i + 1}" ${ply === i + 1 ? 'aria-current="step"' : ""} aria-label="${m.number}${m.side === "w" ? "." : "…"} ${esc(m.san)}. ${esc(describeMove(m))}" ${exploring ? "disabled" : ""}>${m.number}${m.side === "w" ? "." : "…"} ${esc(m.san)}</button>`).join("")}</div><div class="inline-footer"><button data-inline-action="laboratory">${exploring ? "Return to book line" : "Try your own move"}</button><button data-inline-action="share">Share this position</button></div><details class="inline-source"><summary>Original passage & replay source</summary><p>${esc(line.context)}</p><p>${esc(line.note)}</p></details></div>`;
}

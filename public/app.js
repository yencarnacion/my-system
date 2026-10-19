import { Chess, DEFAULT_POSITION } from "./vendor/chess.mjs";

const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  settings:
    '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2" fill="var(--paper)"/><circle cx="16" cy="12" r="2" fill="var(--paper)"/><circle cx="10" cy="19" r="2" fill="var(--paper)"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  prev: '<path d="m15 5-7 7 7 7"/>',
  first: '<path d="M6 5v14m12-14-8 7 8 7"/>',
  last: '<path d="M18 5v14M6 5l8 7-8 7"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  flip: '<path d="M4 9a8 8 0 0 1 14-4l2 2M20 3v4h-4M20 15a8 8 0 0 1-14 4l-2-2M4 21v-4h4"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M5 12v9h14v-9"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  book: '<path d="M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2v15"/>',
};
const icon = (n) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.arrow}</svg>`;
const groupNames = {
  elements: "Part I · The elements",
  position: "Part II · Position play",
  games: "Illustrative games",
  front: "Before you begin",
};
const pieceNames = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem("my-system:" + key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("my-system:" + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};
let book,
  route,
  activeChapter = null,
  activeDiagram = null,
  line = null,
  ply = 0,
  flipped = false,
  timer = null,
  exploring = false,
  sandbox = null,
  selected = null,
  promotion = null,
  savedPly = 0,
  scrollObserver = null;
let prefs = store.get("prefs", {});
if (!prefs || typeof prefs !== "object") prefs = {};
let bookmarks = store.get("bookmarks", []);
if (!Array.isArray(bookmarks)) bookmarks = [];
let completed = store.get("completed", []);
if (!Array.isArray(completed)) completed = [];
let resume = store.get("resume", null);
if (resume && typeof resume !== "object") resume = null;
let currentBlock = null,
  saveScrollTimer,
  readingScroll = 0;
function applyPrefs() {
  document.documentElement.dataset.theme =
    prefs.theme === "night" ? "night" : "paper";
  document.documentElement.style.setProperty(
    "--reader-size",
    ([20, 23, 26].includes(prefs.size) ? prefs.size : 20) + "px",
  );
  $$("button[data-size]").forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      String(+b.dataset.size === (prefs.size || 20)),
    ),
  );
  $$("button[data-theme]").forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.theme === (prefs.theme || "paper")),
    ),
  );
}
applyPrefs();
$("#search-open").innerHTML = icon("search");
$("#settings-open").innerHTML = icon("settings");
$("#search-open").onclick = () => {
  if (!book) return;
  $("#search-dialog").showModal();
  $("#search-input").focus();
  search();
};
$("#settings-open").onclick = () => $("#settings-dialog").showModal();
$$(".close-dialog").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
$$(".dialog-link").forEach(
  (a) => (a.onclick = () => a.closest("dialog").close()),
);
$$("button[data-size]").forEach(
  (b) =>
    (b.onclick = () => {
      prefs.size = +b.dataset.size;
      store.set("prefs", prefs);
      applyPrefs();
    }),
);
$$("button[data-theme]").forEach(
  (b) =>
    (b.onclick = () => {
      prefs.theme = b.dataset.theme;
      store.set("prefs", prefs);
      applyPrefs();
    }),
);
$$("dialog").forEach((d) =>
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  }),
);
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(
    () => $("#toast").classList.remove("visible"),
    3500,
  );
}
function chapterLink(c, block = "", d = "") {
  return `#/read/${c}${block || d ? "?" + new URLSearchParams({ ...(block ? { section: block } : {}), ...(d ? { diagram: d } : {}) }) : ""}`;
}
function footer() {
  return `<footer class="footer"><p>Aron Nimzowitsch · English version by Philip Hereford<br>1929, made interactive.</p><a href="#/about">About this edition & sources ↗</a><a href="./source/my-system-1929.pdf" target="_blank" rel="noopener">Original scan ↗</a></footer>`;
}
function chapterCard(c) {
  return `<a class="chapter-card" href="${chapterLink(c.id)}"><span class="card-number">${c.group === "elements" ? "I" : "II"} / ${String(+c.id.slice(-2)).padStart(2, "0")} ${completed.includes(c.id) ? " · READ" : ""}</span><h3>${esc(c.title)}</h3><div class="card-meta"><span>${c.diagramCount} diagrams · ${Math.ceil(c.wordCount / 180)} min reading</span><span aria-hidden="true">↗</span></div></a>`;
}
function resumeCard() {
  if (!resume || !book.chapters.some((c) => c.id === resume.chapter)) return "";
  const c = book.chapters.find((c) => c.id === resume.chapter);
  return `<div class="resume"><p>YOUR PLACE IS SAVED<strong>${esc(c.title)}</strong></p><a class="button-link primary" href="${chapterLink(c.id, resume.block)}">Continue reading ${icon("arrow")}</a></div>`;
}
function home() {
  $("#main").innerHTML =
    `<div class="page-shell"><section class="hero"><div><p class="eyebrow">The chess classic, brought to life</p><h1>Read the idea.<br><em>Play it out.</em></h1><p class="intro">Enter Nimzowitsch’s world of chess. Explore every diagram, follow the great games, and discover the thinking behind each move.</p><div class="hero-actions"><a class="button-link primary" href="${resume && book.chapters.some((c) => c.id === resume.chapter) ? chapterLink(resume.chapter, resume.block) : chapterLink("pa01ch01")}">${resume ? "Continue reading" : "Open the book"} ${icon("arrow")}</a><a class="button-link" href="#/study?diagram=diagram_III">Try the laboratory</a></div><p class="edition">MY SYSTEM · ARON NIMZOWITSCH<br>Philip Hereford’s 1929 English edition</p><div class="home-note">A board wherever you need one. Your place, remembered.<br>No setup. No account. Just you and the game.</div></div><div class="hero-board"><div id="lab"></div></div></section><div class="stats-row"><div class="stat"><b>15</b><span>chapters of chess thinking</span></div><div class="stat"><b>237</b><span>diagrams, ready to explore</span></div><div class="stat"><b>50</b><span>annotated illustrative games</span></div></div>${resumeCard()}<div class="section-heading"><h2>A foundation for better chess.</h2><a class="text-link" href="#/library">Explore the book →</a></div><div class="chapter-grid">${book.chapters
      .filter((c) => c.group === "elements")
      .slice(0, 3)
      .map(chapterCard)
      .join(
        "",
      )}</div><div class="tip"><strong>Read. Pause. Predict. Play.</strong>Before revealing a move, take a moment to choose your own. Then compare it with the book’s continuation. The laboratory lets you explore a different idea and return to the original line.</div>${footer()}</div>`;
  selectDiagram("diagram_III", 4, false);
  renderLab();
}
function library() {
  $("#main").innerHTML =
    `<div class="page-shell"><div class="page-heading"><p class="eyebrow">Your chess bookshelf</p><h1>A system. One idea at a time.</h1><p>Read in order, revisit an idea, or follow an annotated game. Every chapter has a permanent link and boards ready to play.</p></div>${resumeCard()}<div class="library-toolbar"><input id="library-filter" type="search" placeholder="Find a chapter or player…" aria-label="Filter chapters and games"><select id="library-group" aria-label="Part of the book"><option value="all">The whole book</option><option value="elements">The elements</option><option value="position">Position play</option><option value="games">Illustrative games</option><option value="saved">Your bookmarks</option></select></div><div id="library-list"></div>${footer()}</div>`;
  $("#library-filter").oninput = renderLibrary;
  $("#library-group").onchange = renderLibrary;
  renderLibrary();
}
function renderLibrary() {
  const q = $("#library-filter").value.toLowerCase(),
    group = $("#library-group").value;
  if (group === "saved") {
    $("#library-list").innerHTML = bookmarks.length
      ? bookmarks
          .map(
            (b) =>
              `<a class="game-card" href="${esc(b.url)}"><span>${esc(b.title)}<small>${esc(b.label || "Saved place")}</small></span><span aria-hidden="true">↗</span></a>`,
          )
          .join("")
      : '<p class="empty">No bookmarks yet. Use the bookmark button while reading to save your place.</p>';
    return;
  }
  let output = "";
  for (const g of ["elements", "position", "games", "front"]) {
    if (group !== "all" && group !== g) continue;
    const cs = book.chapters.filter(
      (c) => c.group === g && `${c.title} ${c.id}`.toLowerCase().includes(q),
    );
    if (!cs.length) continue;
    output += `<div class="section-heading"><h2>${groupNames[g]}</h2><span class="muted">${cs.length}</span></div><div class="${g === "games" || g === "front" ? "game-grid" : "chapter-grid"}">${cs.map((c) => (g === "games" || g === "front" ? `<a class="game-card" href="${chapterLink(c.id)}"><span>${esc(c.title)}<small>${g === "games" ? `${Math.ceil((book.games[c.id]?.moves.length || 0) / 2)} moves in replay · ` : ""}${c.diagramCount} diagrams${completed.includes(c.id) ? " · Read" : ""}</small></span><span aria-hidden="true">↗</span></a>` : chapterCard(c))).join("")}</div>`;
  }
  $("#library-list").innerHTML =
    output ||
    '<p class="empty">No matching chapters or games. Try a shorter search.</p>';
}
function toc(c) {
  return `<aside class="toc" aria-label="Table of contents"><a href="#/library">← The whole book</a>${[
    "elements",
    "position",
    "games",
    "front",
  ]
    .map(
      (g) =>
        `<${g === "games" || g === "front" ? "details" : "div"} ${c.group === g ? "open" : ""}>${g === "games" || g === "front" ? `<summary>${groupNames[g]}</summary>` : `<p class="toc-title">${groupNames[g]}</p>`}${book.chapters
          .filter((x) => x.group === g)
          .map(
            (x) =>
              `<a href="${chapterLink(x.id)}" ${x.id === c.id ? 'class="active" aria-current="page"' : ""}><span class="toc-number">${g === "games" ? +x.id.slice(4) : g === "front" ? "·" : +x.id.slice(-2)}</span><span>${esc(x.title.replace(/^Game \d+ · /, ""))}</span></a>`,
          )
          .join("")}</${g === "games" || g === "front" ? "details" : "div"}>`,
    )
    .join("")}</aside>`;
}
function expandPlacement(placement) {
  return placement
    .split("/")
    .flatMap((rank) =>
      [...rank].flatMap((char) =>
        /\d/.test(char) ? Array(+char).fill(null) : [char],
      ),
    );
}
function boardOverlay(d, rotate = false) {
  if (!d?.strokes?.length) return "";
  const point = (s) => {
    const x = s.charCodeAt(0) - 97,
      y = 8 - Number(s[1]);
    return rotate ? [8 - x, 8 - y] : [x, y];
  };
  return `<svg class="board-overlay" viewBox="0 0 8 8" aria-hidden="true">${d.strokes
    .map((s) => {
      const a = point(s.start),
        b = point(s.end);
      return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    })
    .join("")}</svg>`;
}
function miniBoard(d) {
  const squares = expandPlacement(d.placement);
  return `<div class="mini-board " aria-hidden="true">${squares.map((p, i) => `<span class="mini-square ${(Math.floor(i / 8) + (i % 8)) % 2 ? "dark" : ""}">${p ? `<img src="./pieces/${p === p.toUpperCase() ? "w" : "b"}${p.toLowerCase()}.svg" alt="" loading="lazy">` : ""}</span>`).join("")}${boardOverlay(d, false)}</div>`;
}
function translateLinks(html) {
  return html.replace(/href="#([^"]+)"/g, (all, raw) => {
    const id = raw.replace(/^game(\d)$/, "game0$1");
    if (book.chapters.some((c) => c.id === id))
      return `href="${chapterLink(id)}"`;
    const a = book.aliases[id];
    if (a)
      return `href="${chapterLink(a.chapter, a.block || "", a.diagram || "")}"`;
    return 'href="#/library"';
  });
}
function renderBlock(b) {
  if (b.type === "diagram") {
    const d = book.diagrams.find((d) => d.id === b.diagram);
    return `<figure class="diagram-card block" id="${b.id}" data-diagram="${d.id}">${miniBoard(d)}<figcaption><h3>${esc(d.label)}</h3><p>${esc(d.caption || "A position to study")}</p><button class="button-link" data-open-diagram="${d.id}">Explore the board →</button></figcaption></figure>`;
  }
  const text = b.html ? translateLinks(b.html) : esc(b.text);
  if (b.type === "heading" || b.type === "section")
    return `<section class="section-block block" id="${b.id}"><h2>${text}<a class="section-link" href="${chapterLink(activeChapter.id, b.id)}" aria-label="Link to this section">§</a></h2></section>`;
  if (b.type === "table")
    return `<div class="table-scroll block" id="${b.id}" tabindex="0" aria-label="Book table; scroll horizontally">${text}</div>`;
  return `<p class="block" id="${b.id}">${text}</p>`;
}
function read() {
  const c = book.chapters.find((c) => c.id === route.id);
  if (!c) {
    notFound();
    return;
  }
  activeChapter = c;
  let diagram = route.params.get("diagram");
  const ds = book.diagrams.filter((d) => d.chapter === c.id);
  if (!diagram || !ds.some((d) => d.id === diagram))
    diagram = c.id === "pa01ch01" ? "diagram_III" : ds[0]?.id;
  const wantedPly = route.params.has("ply")
    ? Number(route.params.get("ply"))
    : null;
  if (c.game && !route.params.get("diagram"))
    selectGame(c.game, wantedPly ?? 0);
  else if (diagram) selectDiagram(diagram, wantedPly, false);
  else clearLab();
  $("#main").innerHTML =
    `<div class="reading-progress" aria-hidden="true"><span></span></div><div class="mobile-reader-tabs" role="group" aria-label="Reading view"><button id="read-tab" aria-controls="reader-panel" aria-pressed="true" data-view="read">${"Read the book"}</button><button id="board-tab" aria-controls="board-panel" aria-pressed="false" data-view="board">Explore the board</button></div><div class="reader-shell">${toc(c)}<article class="reader-content" id="reader-panel" aria-labelledby="chapter-title"><div class="mobile-contents"><label class="visually-hidden" for="chapter-select">Choose a chapter or game</label><select id="chapter-select">${book.chapters.map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></div><div class="reader-topline"><p class="eyebrow">${groupNames[c.group]} ${c.group === "elements" || c.group === "position" ? ` / ${+c.id.slice(-2)}` : ""}</p><div class="reader-tools"><button class="icon-button" id="bookmark" aria-label="Bookmark this reading position">${icon("bookmark")}</button><button class="icon-button" id="share" aria-label="Share this reading position">${icon("share")}</button></div></div><h1 id="chapter-title" class="reader-title">${esc(c.title)}</h1><p class="chapter-summary">${c.diagramCount} diagrams · ${Math.ceil(c.wordCount / 180)} min reading${c.game ? " · Play the game in the laboratory" : ""}<br>Original text · 1929 edition</p>${c.game ? `<div class="tip"><strong>Follow the game, move by move.</strong>The laboratory uses modern notation and keeps the book’s comments beside the position.<br><button class="text-link" id="open-game">Open game replay →</button></div>` : ""}<div class="prose">${c.blocks.map(renderBlock).join("")}</div><div class="chapter-end"><button id="mark-read" class="${completed.includes(c.id) ? "" : "primary"}">${completed.includes(c.id) ? "✓ Chapter read" : "Mark as read"}</button>${nextChapter(c)}</div></article><aside class="lab-column" id="board-panel" aria-label="Chess laboratory"><div id="lab"></div><div class="lab-context"><p>Pause before the next move. What would you play?</p><p>Use <strong>Try a move</strong> to explore an idea, then return to the book. ← and → work when the board controls have focus.</p><a href="#/about">How this edition was prepared →</a></div></aside></div>`;
  $("#chapter-select").onchange = (e) =>
    (location.hash = chapterLink(e.target.value));
  $$("[data-view]").forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  $$("[data-open-diagram]").forEach(
    (b) =>
      (b.onclick = () => {
        selectDiagram(b.dataset.openDiagram, null, true);
        renderLab();
        setView("board");
      }),
  );
  $$(".diagram-card").forEach(
    (el) =>
      (el.onclick = (e) => {
        if (e.target.closest("button")) return;
        selectDiagram(el.dataset.diagram, null, true);
        renderLab();
        setView("board");
      }),
  );
  $("#bookmark").onclick = saveBookmark;
  $("#share").onclick = share;
  $("#mark-read").onclick = () => {
    completed = completed.includes(c.id)
      ? completed.filter((x) => x !== c.id)
      : [...completed, c.id];
    store.set("completed", completed);
    $("#mark-read").textContent = completed.includes(c.id)
      ? "✓ Chapter read"
      : "Mark as read";
    $("#mark-read").classList.toggle("primary", !completed.includes(c.id));
    toast(
      completed.includes(c.id)
        ? "Chapter marked as read."
        : "Chapter marked unread.",
    );
  };
  if ($("#open-game"))
    $("#open-game").onclick = () => {
      selectGame(c.game, 0);
      updateBoardUrl();
      renderLab();
      setView("board");
    };
  currentBlock = route.params.get("section") || c.blocks[0]?.id;
  renderLab();
  const target = $(`#${CSS.escape(currentBlock || "")}`);
  if (target && route.params.get("section"))
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start" });
      target.classList.add("target");
    });
  if (route.params.get("view") === "board") setView("board", false);
  observeReading();
}
function nextChapter(c) {
  const i = book.chapters.indexOf(c),
    n = book.chapters[i + 1];
  return n
    ? `<a class="button-link" href="${chapterLink(n.id)}">Next: ${esc(n.title)} →</a>`
    : '<a class="button-link" href="#/library">Back to the book →</a>';
}
function observeReading() {
  scrollObserver?.disconnect();
  scrollObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) {
        currentBlock = visible[0].target.id;
        clearTimeout(saveScrollTimer);
        saveScrollTimer = setTimeout(() => {
          if (!activeChapter) return;
          resume = { chapter: activeChapter.id, block: currentBlock };
          store.set("resume", resume);
          const i = activeChapter.blocks.findIndex(
            (b) => b.id === currentBlock,
          );
          const span = $(".reading-progress span");
          if (span)
            span.style.width =
              Math.max(0, (100 * i) / activeChapter.blocks.length) + "%";
        }, 200);
      }
    },
    { rootMargin: "-5% 0px -65% 0px", threshold: 0 },
  );
  $$(".prose .block").forEach((b) => scrollObserver.observe(b));
}
function setView(view, write = true) {
  const shell = $(".reader-shell");
  if (!shell) return;
  const wasBoard = shell.classList.contains("show-board");
  if (view === "board" && !wasBoard) readingScroll = window.scrollY;
  shell.classList.toggle("show-board", view === "board");
  $$("[data-view]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.view === view)),
  );
  if (write && matchMedia("(max-width:760px)").matches) {
    updateBoardUrl({ view, section: currentBlock || null });
    window.scrollTo({
      top: view === "board" ? 74 : readingScroll,
      behavior: "instant",
    });
    if (view === "read" && !readingScroll && currentBlock) {
      document.getElementById(currentBlock)?.scrollIntoView({ block: "start" });
    }
  }
}
function study() {
  $("#main").innerHTML =
    `<div class="page-shell"><div class="study-layout"><section class="study-intro"><p class="eyebrow">The laboratory</p><h1>Make the ideas<br>your own.</h1><p class="muted">A place to pause, predict, and experiment. Pick a diagram from the book or follow one of its illustrative games.</p><label for="study-filter" class="visually-hidden">Find a diagram</label><input id="study-filter" type="search" placeholder="Find a diagram or idea…" style="width:100%"><div class="study-list" id="study-list"></div><div class="tip"><strong>A small habit, a better understanding.</strong>Try to explain the purpose of a move before playing it. Use the original text to check your reasoning.</div><a id="study-read" class="text-link" href="#/library">Read this idea in the book →</a></section><aside class="lab-column" aria-label="Chess laboratory"><div id="lab"></div></aside></div>${footer()}</div>`;
  const id = route.params.get("diagram") || "diagram_III";
  selectDiagram(
    book.diagrams.some((d) => d.id === id) ? id : "diagram_III",
    route.params.has("ply") ? +route.params.get("ply") : null,
    false,
  );
  renderLab();
  renderStudyList();
  $("#study-filter").oninput = renderStudyList;
}
function renderStudyList() {
  const q = $("#study-filter")?.value.toLowerCase() || "";
  const all = book.diagrams.filter((d) =>
    (
      d.label +
      " " +
      d.caption +
      " " +
      book.chapters.find((c) => c.id === d.chapter).title
    )
      .toLowerCase()
      .includes(q),
  );
  const ds = q
    ? all.slice(0, 40)
    : [
        "diagram_III",
        "diagram_XIV",
        "diagram_XXXVIII",
        "diagram_LXXX",
        "diagram_CXX",
      ]
        .map((id) => book.diagrams.find((d) => d.id === id))
        .filter(Boolean);
  $("#study-list").innerHTML = ds.length
    ? ds
        .map(
          (d) =>
            `<button class="study-item ${activeDiagram?.id === d.id ? "active" : ""}" data-study="${d.id}"><span>${esc(d.caption || d.label)}<small>${esc(d.label)} · ${esc(book.chapters.find((c) => c.id === d.chapter).title)}</small></span><span aria-hidden="true">→</span></button>`,
        )
        .join("")
    : "<p>No diagrams found. Try a chapter topic or Roman numeral.</p>";
  $$("[data-study]").forEach(
    (b) =>
      (b.onclick = () => {
        selectDiagram(b.dataset.study, null, true);
        renderLab();
        renderStudyList();
        if (matchMedia("(max-width:760px)").matches)
          $("#lab").scrollIntoView({ block: "start" });
      }),
  );
  if ($("#study-read"))
    $("#study-read").href = chapterLink(
      activeDiagram.chapter,
      activeDiagram.block,
      activeDiagram.id,
    );
}
function clearLab() {
  stopPlay();
  activeDiagram = null;
  line = null;
  ply = 0;
  exploring = false;
  sandbox = null;
  selected = null;
}
function selectGame(id, at = 0) {
  clearLab();
  const g = book.games[id];
  line = { ...g, kind: "game" };
  ply = clamp(at, 0, line.moves.length);
}
function selectDiagram(id, at = null, write = false) {
  clearLab();
  activeDiagram = book.diagrams.find((d) => d.id === id);
  if (!activeDiagram) return;
  const d = activeDiagram;
  if (d.lines?.length)
    line = {
      ...(d.lines.find((l) => l.id === route?.params.get("line")) ||
        d.lines[0]),
    };
  else if (d.game) line = { ...book.games[d.game], kind: "game" };
  else
    line = {
      start: d.fen,
      moves: [],
      title: book.chapters.find((c) => c.id === d.chapter)?.title || d.label,
      kind: "diagram",
    };
  ply = clamp(
    at ?? (line.diagramPly >= 0 ? line.diagramPly : d.game ? d.gamePly : 0),
    0,
    line.moves.length,
  );
  if (write) updateBoardUrl();
}
function clamp(n, min, max) {
  return Math.max(
    min,
    Math.min(max, Number.isFinite(+n) ? Math.floor(+n) : min),
  );
}
function currentFen() {
  return exploring ? sandbox.fen() : ply ? line.moves[ply - 1].fen : line.start;
}
function stopPlay() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
function updateBoardUrl(extra = {}) {
  if (!route || route.page === "home") return;
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  if (activeDiagram) params.set("diagram", activeDiagram.id);
  else params.delete("diagram");
  params.set("ply", String(ply));
  if (activeDiagram?.lines?.some((l) => l.id === line?.id))
    params.set("line", line.id);
  else params.delete("line");
  for (const [k, v] of Object.entries(extra)) {
    if (v === null) params.delete(k);
    else params.set(k, v);
  }
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#/${route.page === "read" ? "read/" + route.id : route.page}?${params}`,
  );
}
function renderLab() {
  const el = $("#lab");
  if (!el) return;
  const focusAction = el.contains(document.activeElement)
    ? document.activeElement.dataset.lab
    : null;
  if (!line) {
    el.innerHTML =
      '<div class="lab"><div class="lab-head"><h2 class="lab-title">Keep a board at hand.</h2></div><div class="annotation">This section has no diagrams. Open a chapter or visit the laboratory to explore a position.</div><div class="lab-aux"><a class="button-link" href="#/study">Go to the laboratory →</a></div></div>';
    return;
  }
  const d = activeDiagram,
    frame = ply ? line.moves[ply - 1] : null,
    fen = currentFen(),
    turn = fen.split(" ")[1];
  const playable = (() => {
    try {
      new Chess(fen);
      return true;
    } catch {
      return false;
    }
  })();
  let commentary = frame?.comment;
  if (exploring) {
    const hist = sandbox.history();
    commentary = hist.length
      ? `Your line: ${hist.join(" ")}\n\n${sandbox.isCheckmate() ? "Checkmate." : sandbox.isStalemate() ? "Stalemate." : sandbox.isCheck() ? "Check. " : ""}Return to the book whenever you’re ready.`
      : "Tap a piece, then a highlighted square. Try an idea and compare it with the book.";
  } else if (!commentary)
    commentary =
      ply === 0
        ? line.prompt ||
          d?.caption ||
          "Begin from the starting position. Before advancing, consider how you would develop your pieces."
        : "Pause here. What changed in the position? Read the surrounding passage for the author’s explanation.";
  const label = exploring
    ? "Your exploration"
    : line.kind === "guided"
      ? "Study note · editorial"
      : frame?.comment
        ? "From the book"
        : ply === 0
          ? "Before you play"
          : "Pause & think";
  const progress = line.moves.length
    ? `Step ${ply} of ${line.moves.length}`
    : d?.conceptual
      ? "Concept illustration"
      : "Book diagram";
  el.innerHTML = `<div class="lab" data-static="${!line.moves.length}"><div class="lab-head"><div><p class="eyebrow">${exploring ? "Your laboratory" : d ? esc(d.label) : "Game replay"}</p><h2 class="lab-title">${esc(line.title || d?.caption || "A position to study")}</h2></div><button class="icon-button" data-lab="flip" aria-label="Flip board; ${flipped ? "Black" : "White"} is currently at the bottom">${icon("flip")}</button></div>${d?.lines?.length > 1 ? `<div class="line-choice"><label class="visually-hidden" for="line-select">Choose a line from the book</label><select id="line-select" class="lab-select">${d.lines.map((l) => `<option value="${l.id}" ${l.id === line.id ? "selected" : ""}>${esc(l.title)}</option>`).join("")}</select></div>` : ""}<div class="board-wrap"><div class="board ${exploring ? "exploring" : ""} " role="group" aria-label="Chessboard, ${flipped ? "Black" : "White"} at the bottom. ${playable ? (turn === "w" ? "White" : "Black") + " to move." : "Schematic illustration."}">${boardSquares(fen, frame)}${boardOverlay(d, flipped)}</div><div class="board-status"><span>${playable ? `<span class="turn-dot ${turn === "b" ? "black" : ""}"></span>${turn === "w" ? "White" : "Black"} to move${d?.turnInferred && line.kind === "diagram" ? " · choose in explore" : ""}` : "Schematic position"}</span><span>${esc(progress)}</span></div></div><div class="board-controls" aria-label="Replay controls"><button data-lab="first" aria-label="Go to the starting position" ${ply === 0 || exploring ? "disabled" : ""}>${icon("first")}</button><button data-lab="prev" aria-label="Previous move" ${ply === 0 || exploring ? "disabled" : ""}>${icon("prev")}</button><button class="play primary" data-lab="play" aria-label="${timer ? "Pause replay" : ply === line.moves.length ? "Replay from the beginning" : "Play moves automatically"}" ${!line.moves.length || exploring ? "disabled" : ""}>${icon(timer ? "pause" : "play")}</button><button data-lab="next" aria-label="Next move" ${ply === line.moves.length || exploring ? "disabled" : ""}>${icon("next")}</button><button data-lab="last" aria-label="Go to the last move" ${ply === line.moves.length || exploring ? "disabled" : ""}>${icon("last")}</button></div><div class="annotation" aria-live="polite" aria-atomic="true"><span class="annotation-label">${label}${frame && !exploring ? ` · ${frame.number}${frame.side === "b" ? "…" : "."} ${esc(frame.san)}` : ""}</span>${esc(commentary)}${frame?.original && !exploring ? `<details><summary>Original notation${frame.correction ? " & correction" : ""}</summary><p>${esc(frame.sourceOriginal || frame.original)}</p>${frame.correction ? `<p>${esc(frame.correction)}</p>` : ""}</details>` : ""}${d?.correction && !exploring ? `<details><summary>Edition correction</summary><p>${esc(d.correction)}</p></details>` : ""}${!playable ? "<p>This is a schematic illustration. Use the text to study the relationships shown.</p>" : ""}</div>${line.moves.length ? `<div class="move-list" aria-label="Moves in the book"><button data-ply="0" class="${ply === 0 ? "active" : ""}" ${exploring ? "disabled" : ""}>Start</button>${line.moves.map((m, i) => `<button data-ply="${i + 1}" class="${ply === i + 1 ? "active" : ""}" ${ply === i + 1 ? 'aria-current="step"' : ""} ${exploring ? "disabled" : ""}><span class="number">${m.number}${m.side === "w" ? "." : "…"}</span>${esc(m.san)}</button>`).join("")}</div>` : ""}<div class="lab-aux">${playable ? `<button data-lab="explore" ${exploring ? 'class="primary"' : ""}>${exploring ? "Return to book" : "Try a move"}</button>` : ""}${exploring ? '<button data-lab="undo">Undo</button>' : `<button data-lab="share">Share position</button>`}${exploring && line.kind === "diagram" ? '<button data-lab="turn">Change turn</button>' : ""}<button data-lab="fen">Copy FEN</button>${line.moves.length ? '<button data-lab="pgn">Download PGN</button>' : ""}</div></div>${line.complete === false ? '<div class="lab-context">This replay stops at a source passage that still needs verification. The remaining original text is available in the reader.</div>' : ""}${d && line.kind === "diagram" ? `<div class="lab-context">${d.turnInferred && d.playable ? "The illustration does not specify a turn. In exploration, choose White or Black with “Change turn”. Castling is unavailable in diagram-only positions. " : ""}<a href="./source/my-system-1929.pdf#page=${d.scanPage}" target="_blank" rel="noopener">Compare with the original scan · p. ${d.page} ↗</a></div>` : ""}`;
  if (d) {
    const passage = document.createElement("div");
    passage.className = "source-passage";
    passage.innerHTML = `<details><summary>Read the surrounding passage</summary><p>${esc(d.context)}</p><a href="${chapterLink(d.chapter, d.block, d.id)}">Open this passage in the book →</a></details>${line.note ? `<details><summary>Source of this replay</summary><p>${esc(line.note)}</p></details>` : ""}`;
    el.append(passage);
  }
  el.querySelectorAll("[data-lab]").forEach(
    (b) => (b.onclick = () => labAction(b.dataset.lab)),
  );
  const chooser = el.querySelector("#line-select");
  if (chooser)
    chooser.onchange = () => {
      stopPlay();
      line = { ...d.lines.find((l) => l.id === chooser.value) };
      exploring = false;
      sandbox = null;
      selected = null;
      ply = Math.max(0, line.diagramPly || 0);
      updateBoardUrl();
      renderLab();
    };
  el.querySelectorAll("[data-ply]").forEach(
    (b) => (b.onclick = () => step(+b.dataset.ply)),
  );
  el.querySelectorAll("[data-square]").forEach(
    (b) => (b.onclick = () => squareClick(b.dataset.square)),
  );
  el.onkeydown = (e) => {
    if (e.target.closest("input,select,textarea")) return;
    if (exploring && e.target.dataset.square) {
      const deltas = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -8,
        ArrowDown: 8,
      };
      if (deltas[e.key]) {
        e.preventDefault();
        const cells = [...el.querySelectorAll("[data-square]")],
          i = cells.indexOf(e.target),
          next = cells[(i + deltas[e.key] + 64) % 64];
        cells.forEach((c) => (c.tabIndex = -1));
        next.tabIndex = 0;
        next.focus();
        return;
      }
    }
    const action = {
      ArrowLeft: "prev",
      ArrowRight: "next",
      Home: "first",
      End: "last",
    }[e.key];
    if (action && !exploring) {
      e.preventDefault();
      labAction(action);
    }
  };
  const active = el.querySelector(".move-list .active");
  if (active) {
    const list = active.parentElement;
    list.scrollTop = Math.max(0, active.offsetTop - list.offsetTop - 60);
  }
  $$(".diagram-card").forEach((card) =>
    card.classList.toggle("selected", card.dataset.diagram === d?.id),
  );
  if (focusAction) {
    const preferred = el.querySelector(`[data-lab="${focusAction}"]`);
    const target =
      preferred && !preferred.disabled
        ? preferred
        : el.querySelector(
            '[data-lab="next"]:not(:disabled), [data-lab="prev"]:not(:disabled)',
          );
    target?.focus({ preventScroll: true });
  }
}
function boardSquares(fen, frame) {
  const cells = expandPlacement(fen.split(" ")[0]),
    legal =
      exploring && selected
        ? sandbox.moves({ square: selected, verbose: true }).map((m) => m.to)
        : [];
  const indices = Array.from({ length: 64 }, (_, i) => (flipped ? 63 - i : i));
  return indices
    .map((idx, display) => {
      const p = cells[idx],
        file = String.fromCharCode(97 + (idx % 8)),
        rank = 8 - Math.floor(idx / 8),
        sq = file + rank,
        dark = (Math.floor(idx / 8) + (idx % 8)) % 2;
      const desc = `${sq}${p ? ", " + (p === p.toUpperCase() ? "White" : "Black") + " " + pieceNames[p.toLowerCase()] : ", empty"}${legal.includes(sq) ? ", legal destination" : ""}`;
      return `<button class="square ${dark ? "dark" : ""} ${!exploring && frame && (frame.from === sq || frame.to === sq) ? "last" : ""} ${selected === sq ? "selected" : ""} ${legal.includes(sq) ? "legal" : ""}" data-square="${sq}" aria-label="${desc}" tabindex="${selected === sq || (!selected && display === 0) ? "0" : "-1"}">${p ? `<img src="./pieces/${p === p.toUpperCase() ? "w" : "b"}${p.toLowerCase()}.svg" alt="" draggable="false">` : ""}${display % 8 === 0 ? `<span class="coord" aria-hidden="true">${rank}</span>` : ""}${display >= 56 ? `<span class="coord file" aria-hidden="true">${file}</span>` : ""}${activeDiagram?.id === "diagram_CXLIX" && ["c5", "d5", "e5"].includes(sq) ? `<span class="marker">${sq === "d5" ? "2" : "1"}</span>` : ""}</button>`;
    })
    .join("");
}
function step(n, auto = false) {
  const focus = $("#lab")?.contains(document.activeElement)
    ? document.activeElement.dataset.lab
    : null;
  if (!auto) stopPlay();
  ply = clamp(n, 0, line.moves.length);
  selected = null;
  updateBoardUrl();
  renderLab();
  if (focus) {
    const target = $(`[data-lab="${focus}"]`);
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else
      $(
        '#lab [data-lab="next"]:not(:disabled), #lab [data-lab="prev"]:not(:disabled)',
      )?.focus({ preventScroll: true });
  }
}
function labAction(action) {
  if (["first", "prev", "next", "last"].includes(action)) {
    if (exploring) return;
    step(
      action === "first"
        ? 0
        : action === "last"
          ? line.moves.length
          : ply + (action === "next" ? 1 : -1),
    );
    return;
  }
  if (action === "play") {
    if (timer) {
      stopPlay();
      renderLab();
      return;
    }
    if (exploring || !line.moves.length) return;
    if (ply >= line.moves.length) ply = 0;
    timer = setInterval(() => {
      if (ply + 1 >= line.moves.length) {
        stopPlay();
        step(line.moves.length, true);
      } else step(ply + 1, true);
    }, 2600);
    renderLab();
    return;
  }
  if (action === "flip") {
    flipped = !flipped;
    renderLab();
    return;
  }
  if (action === "explore") {
    stopPlay();
    if (exploring) {
      exploring = false;
      sandbox = null;
      ply = savedPly;
    } else {
      try {
        sandbox = new Chess(currentFen());
      } catch {
        return;
      }
      savedPly = ply;
      exploring = true;
    }
    selected = null;
    renderLab();
    return;
  }
  if (action === "undo") {
    sandbox?.undo();
    selected = null;
    renderLab();
    return;
  }
  if (action === "turn") {
    const parts = sandbox.fen().split(" ");
    parts[1] = parts[1] === "w" ? "b" : "w";
    parts[3] = "-";
    try {
      sandbox = new Chess(parts.join(" "));
      selected = null;
      renderLab();
    } catch {
      toast("This position cannot be played with the other side to move.");
    }
    return;
  }
  if (action === "fen") {
    copy(currentFen(), "Position copied as FEN.");
    return;
  }
  if (action === "share") {
    share(true);
    return;
  }
  if (action === "pgn") {
    downloadPGN();
  }
}
function squareClick(square) {
  if (!exploring) return;
  const p = sandbox.get(square);
  if (selected) {
    const ms = sandbox
      .moves({ square: selected, verbose: true })
      .filter((m) => m.to === square);
    if (ms.length) {
      if (ms.some((m) => m.promotion)) {
        choosePromotion(selected, square);
        return;
      }
      sandbox.move({ from: selected, to: square });
      selected = null;
      renderLab();
      $(`[data-square="${square}"]`)?.focus({ preventScroll: true });
      return;
    }
  }
  selected = p && p.color === sandbox.turn() ? square : null;
  renderLab();
  $(`[data-square="${square}"]`)?.focus({ preventScroll: true });
}
function choosePromotion(from, to) {
  const d = document.createElement("dialog");
  d.setAttribute("aria-label", "Choose promotion piece");
  d.innerHTML =
    '<h2>Promote your pawn.</h2><div class="promotion-options">' +
    ["q", "r", "b", "n"]
      .map(
        (p) =>
          `<button data-promote="${p}" aria-label="Promote to ${pieceNames[p]}"><img alt="" src="./pieces/${sandbox.turn()}${p}.svg"></button>`,
      )
      .join("") +
    '</div><button class="text-link" data-cancel>Cancel</button>';
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.querySelector("[data-cancel]").onclick = () => d.close();
  d.querySelectorAll("[data-promote]").forEach(
    (b) =>
      (b.onclick = () => {
        sandbox.move({ from, to, promotion: b.dataset.promote });
        selected = null;
        d.close();
        renderLab();
      }),
  );
  d.showModal();
}
function copy(value, message) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast(message))
      .catch(() => copyFallback(value, message));
  } else copyFallback(value, message);
}
function copyFallback(value, message) {
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {}
  input.remove();
  if (ok) toast(message);
  else {
    const d = document.createElement("dialog");
    d.innerHTML =
      '<h2>Copy this link or position</h2><textarea readonly style="width:100%;min-height:130px"></textarea><button>Done</button>';
    d.querySelector("textarea").value = value;
    d.querySelector("button").onclick = () => d.close();
    d.onclose = () => d.remove();
    document.body.append(d);
    d.showModal();
    d.querySelector("textarea").select();
  }
}
function share(position = false) {
  if (exploring && position) {
    copy(currentFen(), "Your exploration copied as FEN.");
    return;
  }
  const url = new URL(location.href);
  if (route.page === "home")
    url.hash = "#/study?diagram=diagram_III&ply=" + ply;
  else {
    const params = new URLSearchParams(url.hash.split("?")[1] || "");
    if (position) {
      if (activeDiagram) params.set("diagram", activeDiagram.id);
      params.set("ply", ply);
      if (route.page === "read") params.set("view", "board");
    } else if (currentBlock) params.set("section", currentBlock);
    url.hash = url.hash.split("?")[0] + "?" + params;
  }
  if (navigator.share) {
    navigator
      .share({
        title:
          "My System · " +
          (activeChapter?.title || line?.title || "Chess laboratory"),
        url: url.href,
      })
      .catch((e) => {
        if (e.name !== "AbortError") copy(url.href, "Link copied.");
      });
  } else copy(url.href, "Link copied.");
}
function saveBookmark() {
  const url = chapterLink(activeChapter.id, currentBlock),
    exists = bookmarks.some((b) => b.url === url);
  bookmarks = exists
    ? bookmarks.filter((b) => b.url !== url)
    : [
        ...bookmarks,
        {
          url,
          title: activeChapter.title,
          label:
            activeChapter.blocks
              .find((b) => b.id === currentBlock)
              ?.text.slice(0, 110) || "Chapter opening",
        },
      ];
  store.set("bookmarks", bookmarks);
  $("#bookmark").setAttribute("aria-pressed", String(!exists));
  toast(exists ? "Bookmark removed." : "Bookmark saved in your bookshelf.");
}
function downloadPGN() {
  const chess = new Chess(line.start);
  chess.header(
    "Event",
    line.title || "My System",
    "Source",
    "My System (1929), Aron Nimzowitsch / Philip Hereford",
  );
  for (const m of line.moves) {
    chess.move(m.san);
    if (m.comment) chess.setComment(m.comment.replace(/[{}]/g, ""));
  }
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([chess.pgn()], { type: "application/x-chess-pgn" }),
    );
  a.href = url;
  a.download = (line.id || activeDiagram?.id || "my-system") + ".pgn";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function about() {
  $("#main").innerHTML =
    `<div class="page-shell about"><p class="eyebrow">About this edition</p><h1 class="reader-title">An old book.<br>A new way to study.</h1><p>This is an interactive reading edition of <em>My System</em> by Aron Nimzowitsch, in Philip Hereford’s 1929 English translation. It preserves the book’s original prose and descriptive notation, with modern algebraic notation in the replays.</p><h2>How to use the laboratory</h2><ol><li>Read a short passage. Open its diagram to put the position on the board.</li><li>Pause and choose a move before revealing the continuation. Use the arrows, tap a move, or play the sequence automatically.</li><li>Select <strong>Try a move</strong> to explore your own line. Legal destinations are marked. <strong>Return to book</strong> restores the exact position you left.</li><li>Bookmark a passage or share a link to a section and replay position.</li></ol><p>On a phone, switch between <strong>Read the book</strong> and <strong>Explore the board</strong>. On a larger screen, both remain side by side. Progress is stored only in this browser; it does not sync between devices.</p><h2>Sources & editorial care</h2><p>The full text and 237 diagram records were recovered from the supplied hand-edited digital edition. The supplied OCR text and the <a href="./source/my-system-1929.pdf">1929 scan</a> provide comparison sources. This is a working transcription, not a claim of complete proofreading.</p><p>The 50 game replays contain ${book.stats.replayMoves.toLocaleString()} legally checked half-moves. Another ${book.stats.chapterLines} recovered chapter lines connect the prose to the board; in total, ${book.stats.replayableDiagrams} diagrams have attached replays. The other illustrations remain available to study and, where playable, explore manually. Legal validation checks whether a move can be played; it does not prove that every transcription matches the printed book. Some examples are pawn skeletons or combined illustrations rather than legal positions. These are displayed as schematic diagrams.</p><p>Where the author gives a game score, the replay follows that score. A diagram without an attached sequence can be explored manually when it is a playable position. The short introductory teaching cues are labelled <strong>editorial</strong>; the original game annotations are labelled <strong>From the book</strong>.</p><p>Known errors are recorded in the repository’s correction ledger. Examples include eight restored moves in Game 2 and misprinted piece placements in Games 11 and 45. Original spelling, historical references, and the author’s opinions remain part of the source text.</p><h2>Built for comfortable reading</h2><p>The reader uses generous line spacing, a moderate text measure, adjustable 20–26 pixel text, and a night theme. Main controls are at least 44 pixels high, following <a href="https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced" target="_blank" rel="noopener">W3C guidance on target size</a>. There is no animation required to understand a move. Keyboard and reduced-motion preferences are supported.</p><p>“Read, predict, compare” is a study prompt, not a claim that this app has been scientifically tested. You can read straight through, work on a single position, or return to a saved passage.</p><h2>Portable by design</h2><p>The app is a static site. It needs no account, advertising, tracking, database, or paid chess service. After the first successful online visit, the book and boards are cached for offline reading where the browser supports it. The large original PDF is downloaded separately.</p><h2>Credits</h2><p>Book: Aron Nimzowitsch. English version: Philip Hereford. London: G. Bell and Sons, 1929. The source edition was supplied as public-domain material.</p><p>Chess rules: <a href="https://github.com/jhlywa/chess.js">chess.js</a> 1.4.0, BSD-2-Clause. Chess piece artwork: <a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces">Cburnett, Wikimedia Commons</a>, CC BY-SA 3.0; adapted only to scale responsively. See <a href="./THIRD-PARTY-NOTICES.txt">third-party notices</a>.</p>${footer()}</div>`;
}
function search() {
  const q = $("#search-input").value.trim().toLowerCase();
  if (q.length < 2) {
    $("#search-count").textContent = "Enter at least two characters.";
    $("#search-results").innerHTML = "";
    return;
  }
  const results = [];
  for (const c of book.chapters) {
    if (c.title.toLowerCase().includes(q))
      results.push({
        title: c.title,
        text: `${groupNames[c.group]} · ${c.diagramCount} diagrams`,
        url: chapterLink(c.id),
      });
    for (const b of c.blocks) {
      const d = b.diagram
        ? book.diagrams.find((d) => d.id === b.diagram)
        : null;
      const text = (d?.label || "") + " " + b.text;
      const at = text.toLowerCase().indexOf(q);
      if (at >= 0)
        results.push({
          title: d ? d.label + " · " + c.title : c.title,
          text:
            (at > 60 ? "…" : "") +
            text.slice(Math.max(0, at - 60), at + 170) +
            (at + 170 < text.length ? "…" : ""),
          url: chapterLink(c.id, b.id, d?.id),
        });
    }
  }
  const limited = results.slice(0, 60);
  $("#search-count").textContent =
    `${results.length} matches${results.length > 60 ? " · showing the first 60" : ""}`;
  $("#search-results").innerHTML =
    limited
      .map(
        (r) =>
          `<a class="search-result" href="${r.url}"><strong>${esc(r.title)}</strong><p>${esc(r.text)}</p></a>`,
      )
      .join("") ||
    "<p>No matches. Try another term, a player, or a diagram number.</p>";
  $$(".search-result").forEach(
    (a) => (a.onclick = () => $("#search-dialog").close()),
  );
}
$("#search-input").oninput = search;
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    $("#search-open").click();
  }
});
function notFound() {
  $("#main").innerHTML =
    '<div class="page-shell"><h1>That page is not in this edition.</h1><p>The link may be incomplete. Choose a chapter from the bookshelf.</p><a class="button-link primary" href="#/library">Open the book</a></div>';
}
function renderRoute() {
  stopPlay();
  scrollObserver?.disconnect();
  clearTimeout(saveScrollTimer);
  activeChapter = null;
  currentBlock = null;
  readingScroll = 0;
  const hash = location.hash.slice(1) || "/";
  const [url, query = ""] = hash.split("?");
  const parts = url.split("/").filter(Boolean);
  route = {
    page: parts[0] || "home",
    id: parts[1],
    params: new URLSearchParams(query),
  };
  window.scrollTo(0, 0);
  if (route.page === "read") read();
  else if (route.page === "library") library();
  else if (route.page === "study") study();
  else if (route.page === "about") about();
  else if (route.page === "home") home();
  else notFound();
  document.title =
    (activeChapter
      ? activeChapter.title + " · "
      : route.page === "study"
        ? "The laboratory · "
        : "") + "My System";
  $$(".topbar nav a").forEach((a) =>
    a.classList.toggle(
      "active",
      (a.hash === "#/library" && ["read", "library"].includes(route.page)) ||
        (a.hash === "#/study" && route.page === "study"),
    ),
  );
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && timer) {
    stopPlay();
    renderLab();
  }
});
try {
  const res = await fetch(new URL("./data/book.json", import.meta.url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  book = await res.json();
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1")
  )
    navigator.serviceWorker.register("./sw.js").catch(() => {});
} catch (error) {
  $("#main").innerHTML =
    `<div class="page-shell"><h1>The book could not be opened.</h1><p>Check your connection and reload this page. If you opened a downloaded file directly, start the included local server first.</p><button onclick="location.reload()">Try again</button><p><a href="./source/my-system-1929.pdf">Read the original scan</a></p></div>`;
  console.error(error);
}

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const book = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/book.json")),
);
if (
  book.chapters.length !== 69 ||
  book.diagrams.length !== 237 ||
  Object.values(book.games).some((g) => !g.complete)
)
  throw Error(
    "Content checks failed; run the importer and inspect its report.",
  );
const output = path.join(root, "dist");
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(path.join(root, "public"), output, { recursive: true });
const version = crypto
  .createHash("sha256")
  .update(fs.readFileSync(path.join(output, "app.js")))
  .update(fs.readFileSync(path.join(output, "passage-view.js")))
  .update(fs.readFileSync(path.join(output, "style.css")))
  .update(fs.readFileSync(path.join(output, "data/book.json")))
  .digest("hex")
  .slice(0, 16);
const sw = fs
  .readFileSync(path.join(output, "sw.js"), "utf8")
  .replace("BUILD_VERSION", version);
fs.writeFileSync(path.join(output, "sw.js"), sw);
fs.writeFileSync(path.join(output, ".nojekyll"), "");
// Hash routing works on a project path without web-server rewrite rules.
console.log(
  `Built dist/ (${book.stats.replayMoves} replay plies; cache ${version}). No runtime dependencies or credentials.`,
);

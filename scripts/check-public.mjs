import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folders = ["public", "scripts", "sources", "tests", "docs"];
if (fs.existsSync(path.join(root, ".github"))) folders.push(".github");
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub credential", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["OpenAI credential", /\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b/],
  ["Slack credential", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["personal filesystem path", /\/(?:home|Users)\/[A-Za-z0-9._-]+\//],
  [
    "private service address",
    /https?:\/\/(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?/,
  ],
];
let files = 0,
  failed = false;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink())
      throw Error(
        "Public source must not contain symlinks: " + path.relative(root, file),
      );
    if (entry.isDirectory()) {
      if (entry.name === "__pycache__") continue;
      visit(file);
      continue;
    }
    files++;
    if (!/\.(?:m?js|json|txt|md|html|css|svg|py|yml|webmanifest)$/.test(file))
      continue;
    // This scanner defines the patterns it looks for, so omit its own literals.
    if (file === fileURLToPath(import.meta.url)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const [name, pattern] of patterns)
      if (pattern.test(text)) {
        console.error(`${path.relative(root, file)}: ${name}`);
        failed = true;
      }
  }
}
folders.forEach((folder) => visit(path.join(root, folder)));
if (failed) process.exitCode = 1;
else console.log(`Public-source scan passed for ${files} files.`);

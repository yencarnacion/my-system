import { createServer } from "./server.mjs";
import { spawn } from "node:child_process";
const server = await createServer(
  new URL("../dist", import.meta.url).pathname,
  { prefix: "/my-system/", port: 0 },
);
const url = `http://127.0.0.1:${server.address().port}/my-system/`;
console.log(`Browser check on ${url}`);
const child = spawn(
  "python3",
  [
    new URL("../tests/browser.py", import.meta.url).pathname,
    url,
    process.argv[2] || "",
  ],
  { stdio: "inherit" },
);
child.on("error", (e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
child.on("exit", (code) => {
  server.close();
  process.exitCode = code;
});

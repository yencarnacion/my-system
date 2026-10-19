import { createServer } from "./server.mjs";
const server = await createServer(
  new URL("../public", import.meta.url).pathname,
  {
    port: Number(process.env.PORT || 4173),
    host: process.env.HOST || "127.0.0.1",
  },
);
console.log(
  `My System: http://${process.env.HOST || "127.0.0.1"}:${server.address().port}/`,
);

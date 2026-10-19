const CACHE = "my-system-BUILD_VERSION";
const CORE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./passage-view.js",
  "./vendor/chess.mjs",
  "./data/book.json",
  "./icon.svg",
  "./manifest.webmanifest",
  ...["w", "b"].flatMap((c) =>
    ["p", "n", "b", "r", "q", "k"].map((p) => `./pieces/${c}${p}.svg`),
  ),
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("my-system-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.endsWith(".pdf")
  )
    return;
  // Network first preserves updates; a previously opened edition remains readable offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (hit) =>
            hit ||
            new Response("Offline. Open the book once while connected.", {
              status: 503,
            }),
        ),
      ),
  );
});

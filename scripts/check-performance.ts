/** Measure the built signed-out shell on a throttled connection; never claim hardware FPS from headless Chromium. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
const root = resolve("dist/web");
const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/api/")) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end('{"error":"Sign in to continue"}');
    return;
  }
  const requested = decodeURIComponent(
    new URL(req.url ?? "/", "http://localhost").pathname,
  );
  const file = resolve(
    root,
    "." +
      (requested === "/" || requested === "/styleguide"
        ? "/index.html"
        : requested),
  );
  if (!file.startsWith(root + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const content = await readFile(file),
      extension = extname(file);
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".webmanifest": "application/manifest+json",
      ".png": "image/png",
      ".webm": "audio/webm",
    };
    res.writeHead(200, {
      "content-type": types[extension] ?? "application/octet-stream",
      "content-encoding": "gzip",
      "cache-control": "no-store",
    });
    res.end(gzipSync(content));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise<void>((r) => server.listen(4173, "127.0.0.1", r));
const browser = await chromium.launch();
mkdirSync("test-results", { recursive: true });
try {
  const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage(),
    cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 80,
    downloadThroughput: 4_000_000 / 8,
    uploadThroughput: 1_000_000 / 8,
  });
  const mediaRequests: string[] = [];
  page.on("request", (r) => {
    if (/desk-(scene|audio)|\/audio\//.test(r.url()))
      mediaRequests.push(r.url());
  });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByRole("button", { name: "Enter as guest" }).waitFor();
  const ready = await page.evaluate(() => performance.now());
  const paint = await page.evaluate(() =>
    performance
      .getEntriesByType("paint")
      .map((p) => ({ name: p.name, ms: p.startTime })),
  );
  if (mediaRequests.length) throw new Error("Optional media eagerly fetched");
  if (ready >= 2000)
    throw new Error(`Signed-out shell exceeded 2s: ${ready.toFixed(0)}ms`);
  await page.goto("http://127.0.0.1:4173/styleguide");
  await page.getByRole("heading", { name: "The arcane dossier" }).waitFor();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(`Overflow at ${width}`);
    await page.screenshot({
      path: `test-results/desk-styleguide-${width}.png`,
      fullPage: true,
    });
  }
  const report = {
    connection: "4 Mbps / 80ms",
    signedOutShellReadyMs: Math.round(ready),
    paint,
    initialMediaRequests: mediaRequests.length,
    limitations:
      "Unauthenticated production shell only; headless desktop CPU, not a physical Android or integrated-GPU frame-rate certification.",
  };
  writeFileSync(
    "test-results/performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
}

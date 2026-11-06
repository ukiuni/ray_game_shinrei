import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
test("downloads update during play but activates only after session ends", async ({
  page,
}) => {
  let update = false;
  const root = resolve("dist");
  const server = createServer(async (req, res) => {
    try {
      let p = resolve(
        root,
        "." + new URL(req.url, "http://localhost").pathname,
      );
      if (!p.startsWith(root)) throw Error();
      if ((await stat(p)).isDirectory()) p += "/index.html";
      let data = await readFile(p);
      if (p.endsWith("/sw.js") && update)
        data = Buffer.from(
          data.toString().replace(/unseen-([a-f0-9]+)/, "unseen-updated-$1"),
        );
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".webp": "image/webp",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
      };
      res.setHeader(
        "Content-Type",
        mime[extname(p)] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-store");
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((r) =>
          navigator.serviceWorker.addEventListener("controllerchange", r, {
            once: true,
          }),
        );
    });
    await page.locator("#start").click();
    await expect(page.locator("#game-message")).toHaveText(
      "心霊が写っている場所をタップしてください。",
    );
    update = true;
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r.update();
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            !!(await navigator.serviceWorker.getRegistration()).waiting,
        ),
      )
      .toBe(true);
    await expect(page.locator("#game")).toBeVisible();
    await expect(page.locator("#update")).toBeHidden();
    await page.locator("#quit").click();
    await expect(page.locator("#home")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const k = await caches.keys();
          return k.length === 1 && k[0].startsWith("unseen-updated-");
        }),
      )
      .toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

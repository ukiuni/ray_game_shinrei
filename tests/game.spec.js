import { test, expect } from "@playwright/test";
import { hitTest, shuffled, remainingSeconds } from "../logic.js";
async function begin(page) {
  await page.goto("/");
  await page.locator("#start").click();
  await expect(page.locator("#game-message")).toHaveText(
    "心霊が写っている場所をタップしてください。",
  );
}
async function target(page) {
  const list = await (await page.request.get("/photos.json")).json();
  const src = await page.locator("#photo").getAttribute("src");
  return list.find((p) => "./" + p.src === src).target;
}
async function clickAt(page, x, y) {
  const b = await page.locator("#photo-area").boundingBox();
  await page.mouse.click(b.x + b.width * x, b.y + b.height * y);
}
test("100 distinct photos, valid targets and hit geometry", async ({
  request,
}) => {
  const p = await (await request.get("/photos.json")).json();
  expect(p).toHaveLength(100);
  expect(new Set(p.map((x) => x.src)).size).toBe(100);
  for (const x of p) {
    expect(hitTest(x.target, x.target.x, x.target.y)).toBe(true);
    expect(hitTest(x.target, 0, 0)).toBe(false);
    expect(x.target.x - x.target.rx).toBeGreaterThanOrEqual(0);
    expect(x.target.y + x.target.ry).toBeLessThanOrEqual(1);
  }
  expect(new Set(shuffled(100)).size).toBe(100);
  expect(remainingSeconds(30000, 29999)).toBe(1);
  expect(remainingSeconds(30000, 30001)).toBe(0);
});
test("home fits viewport and starts playable photo", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toContainText("その写真には");
  const fits = await page.evaluate(() => {
    const b = document.querySelector("#start").getBoundingClientRect();
    return (
      b.bottom <= innerHeight &&
      b.top >= 0 &&
      document.documentElement.scrollWidth <= innerWidth
    );
  });
  expect(fits).toBe(true);
  await page.locator("#start").click();
  await expect(page.locator("#photo")).toBeVisible();
  await expect(page.locator("#game-message")).toHaveText(
    "心霊が写っている場所をタップしてください。",
  );
  expect(
    await page.locator("#photo").evaluate((i) => i.naturalWidth),
  ).toBeGreaterThan(0);
});
test("wrong tap shows cross, correct tap shows circle and automatically advances", async ({
  page,
}) => {
  await begin(page);
  const src = await page.locator("#photo").getAttribute("src");
  await clickAt(page, 0.02, 0.02);
  await expect(page.locator(".wrong")).toBeVisible();
  await expect(page.locator("#lives")).toHaveText("● ●");
  const t = await target(page);
  await clickAt(page, t.x, t.y);
  await expect(page.locator(".correct")).toBeVisible();
  await expect(page.locator("#overlay")).toContainText("正解");
  await expect(page.locator("#photo")).not.toHaveAttribute("src", src);
  await expect(page.locator("#streak")).toHaveText("01");
  await expect(page.locator("#lives")).toHaveText("● ●");
});
test("three misses ends session and retry resets lives", async ({ page }) => {
  await begin(page);
  for (let i = 0; i < 3; i++) await clickAt(page, 0.02, 0.02);
  await expect(page.locator(".answer")).toBeVisible();
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#reason")).toContainText("3回");
  await page.locator("#restart").click();
  await expect(page.locator("#lives")).toHaveText("● ● ●");
});
test("timeout even after returning from background", async ({ page }) => {
  await page.clock.install();
  await begin(page);
  await page.clock.fastForward(31000);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#reason")).toContainText("時間切れ");
});
test("all 100 wins automatically finish with perfect score", async ({
  page,
}) => {
  await page.clock.install();
  await begin(page);
  for (let i = 0; i < 100; i++) {
    await expect(page.locator("#game-message")).toHaveText(
      "心霊が写っている場所をタップしてください。",
    );
    const t = await target(page);
    await clickAt(page, t.x, t.y);
    await expect(page.locator("#overlay")).toBeVisible();
    await page.clock.fastForward(1400);
  }
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#result-score")).toHaveText("100");
  await expect(page.locator("#reason")).toContainText("全100枚");
});
test("PWA caches all photos and plays offline after reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) =>
        navigator.serviceWorker.addEventListener("controllerchange", r, {
          once: true,
        }),
      );
  });
  const count = await page.evaluate(async () => {
    const k = (await caches.keys()).find((k) => k.startsWith("unseen-"));
    return (await (await caches.open(k)).keys()).filter((r) =>
      r.url.includes("/photos/"),
    ).length;
  });
  expect(count).toBe(100);
  await context.setOffline(true);
  await page.reload();
  await page.locator("#start").click();
  await expect(page.locator("#game-message")).toHaveText(
    "心霊が写っている場所をタップしてください。",
  );
  const t = await target(page);
  await clickAt(page, t.x, t.y);
  await expect(page.locator("#overlay")).toBeVisible();
});
test("fixed viewport remains usable in portrait and landscape", async ({
  page,
}) => {
  for (const size of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/");
    const home = await page.locator("#start").boundingBox();
    expect(home.y).toBeGreaterThanOrEqual(0);
    expect(home.y + home.height).toBeLessThanOrEqual(size.height);
    await page.locator("#start").click();
    await expect(page.locator("#game-message")).toHaveText(
      "心霊が写っている場所をタップしてください。",
    );
    const photo = await page.locator("#photo-area").boundingBox();
    expect(photo.y).toBeGreaterThanOrEqual(0);
    expect(photo.y + photo.height).toBeLessThanOrEqual(size.height);
    expect(photo.width / photo.height).toBeCloseTo(1.5, 1);
  }
});
test("late initial installation event never locks the start button", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const sw = new EventTarget();
    sw.controller = {};
    const registration = new EventTarget();
    registration.waiting = null;
    const worker = new EventTarget();
    worker.state = "installed";
    worker.postMessage = () => {};
    registration.installing = worker;
    sw.register = async () => {
      setTimeout(() => {
        registration.dispatchEvent(new Event("updatefound"));
        worker.dispatchEvent(new Event("statechange"));
        window.installationEventDelivered = true;
      }, 100);
      return registration;
    };
    Object.defineProperty(navigator, "serviceWorker", { value: sw });
  });
  await page.goto("/");
  await page.waitForFunction(() => window.installationEventDelivered);
  await expect(page.locator("#update")).toBeHidden();
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator("#start").click();
  await expect(page.locator("#game-message")).toHaveText(
    "心霊が写っている場所をタップしてください。",
  );
});

/** Real seeded retention journey. Fixtures age server data; the browser cannot submit time or rewards. */
import { test, expect } from "@playwright/test";
import { prisma, closeDatabase } from "../../packages/database/src/index.ts";
import { initialState } from "../../packages/engine/src/index.ts";
test.afterAll(async () => closeDatabase());
test("optional media stays lazy and preferences retain a zero volume", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.request.post("/api/auth/guest", {
    data: {},
    headers: { origin: "http://localhost:5173" },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  expect(
    requests.some((url) => /desk-scene|desk-audio|\/audio\//.test(url)),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Open optional 3D inspection" })
    .click();
  await expect
    .poll(() => requests.some((url) => url.includes("desk-scene")))
    .toBe(true);
  await expect(
    page.locator("canvas").or(page.getByText(/3D unavailable/)),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close 3D inspection" }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByText("Desk preferences · motion & sound").click();
  await page.getByRole("button", { name: "Enable audio", exact: true }).click();
  await expect
    .poll(() =>
      requests.some((url) => url.includes("/audio/ambient-base.webm")),
    )
    .toBe(true);
  await page.getByLabel("Audio volume").fill("0");
  await page.getByLabel("Motion speed").selectOption("0");
  await expect(
    page.getByRole("button", { name: "Open optional 3D inspection" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByText("Desk preferences · motion & sound").click();
  await expect(page.getByLabel("Audio volume")).toHaveValue("0");
  await expect(page.getByLabel("Motion speed")).toHaveValue("0");
});
test("offline recap, ledger, supply, faction, weekly crew and Ash Cycle", async ({
  page,
}) => {
  await page.request.post("/api/auth/guest", {
    data: {},
    headers: { origin: "http://localhost:5173" },
  });
  const identity = (await (await page.request.get("/api/me")).json()) as {
    id: string;
  };
  const now = Date.now(),
    s = initialState(now - 30 * 3600000);
  s.level = 12;
  s.cash = 5000;
  s.mastery = { quay: 20, ledger: 20, tally: 20 };
  s.crew.push(0);
  s.chronicle.weeklyBucket = Math.floor(now / 604800000);
  s.chronicle.weeklyOps = 10;
  s.holdings = [
    { era: 0, tier: 1, bank: 0, lastAt: s.lastTickAt },
    { era: 1, tier: 1, bank: 0, lastAt: s.lastTickAt },
  ];
  await prisma.player.update({
    where: { id: identity.id },
    data: { state: s },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toContainText("Ember Ledger report");
  await page.getByRole("button", { name: "File report and return" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Settle weekly crew operation" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Weekly crew operation settled",
  );
  await page.getByRole("button", { name: "Ledger", exact: true }).click();
  await page.getByRole("button", { name: "Forge entry · 3 nerve" }).click();
  await expect(page.getByRole("status")).toContainText("Forged");
  await page.getByRole("button", { name: "Audit entries · 2 nerve" }).click();
  await expect(page.getByRole("status")).toContainText("Audit sealed");
  await page.getByRole("button", { name: "Redact · 40" }).first().click();
  await expect(page.getByText("[REDACTED]", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Crew & Holdings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Supply quay ↔ steps · 75 crowns" })
    .click();
  await expect(page.getByRole("status")).toContainText("Supply line");
  await page
    .getByRole("button", { name: "Reassure · 50 crowns" })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("restored loyalty");
  await expect(
    page.getByRole("button", { name: "Open optional 3D inspection" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Conflict", exact: true }).click();
  await page
    .getByRole("button", { name: "Suppress pressure · 3 stamina" })
    .click();
  await expect(page.getByRole("status")).toContainText("withdrew");
  await page.getByRole("button", { name: "Operations", exact: true }).click();
  await page
    .getByRole("button", { name: "Close Ash Cycle", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("1 permanent ash");
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(
    page.locator(".badge.material-ember-glass.earned"),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/chronicle-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(
    await prisma.telemetryEvent.count({
      where: { playerId: identity.id, type: "ash-cycle" },
    }),
  ).toBe(1);
});

/** Smoke the genuine first-session loop and mobile overflow, with no mocked game rewards. */
import { test, expect } from "@playwright/test";
test("register and build a first syndicate", async ({ page, browser }) => {
  const rivalContext = await browser.newContext();
  await rivalContext.request.post("http://localhost:5173/api/auth/guest", {
    data: {},
    headers: { origin: "http://localhost:5173" },
  });
  const rivalIdentity = (await (
    await rivalContext.request.get("http://localhost:5173/api/me")
  ).json()) as { name: string };
  await page.goto("/");
  await page.getByLabel("Operator name").fill("Smoke Warlord");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`smoke-${Date.now()}@example.test`);
  await page
    .getByLabel("Password · 12+ characters")
    .fill("Native-test-secret-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operations", exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Run operation" }).first().click();
    await page
      .getByRole("button", { name: "Resolve operation", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("complete");
  }
  await page.getByRole("button", { name: /attack 0/ }).click();
  await expect(page.getByRole("button", { name: /attack 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Arsenal", exact: true }).click();
  await page.getByRole("button", { name: "Buy · 100", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("completed");
  await page.getByRole("button", { name: "Equip", exact: true }).click();
  await page
    .getByRole("button", { name: "Crew & Holdings", exact: true })
    .click();
  await page.getByRole("button", { name: /Recruit crew/ }).click();
  await expect(page.getByText("2 / 100 crew")).toBeVisible();
  await page.getByRole("button", { name: /Build holding/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tier 1 counting house" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Conflict", exact: true }).click();
  await page.getByRole("button", { name: "strike", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("damage");
  const rival = page.locator("article").filter({ hasText: rivalIdentity.name });
  await rival.getByRole("button", { name: "Attack", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Duel");
  await page.getByRole("button", { name: "Territory", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Operators of renown" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/core-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/core-mobile.png",
    fullPage: true,
  });
  await rivalContext.close();
});
test("guest upgrades without losing progress and another tab receives live rewards", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  await first.goto("/");
  await first.getByRole("button", { name: "Enter as guest" }).click();
  await expect(
    first.getByRole("heading", { name: "Operations", exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator(".rail-foot")).toContainText(
    "Ember Line connected",
  );
  await first.getByRole("button", { name: "Run operation" }).first().click();
  await first
    .getByRole("button", { name: "Resolve operation", exact: true })
    .click();
  await expect(second.getByText("1/20 mastery", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await first.getByRole("button", { name: "Account", exact: true }).click();
  await first.getByLabel("Operator name").fill("Upgraded Wayfarer");
  await first
    .getByLabel("Email", { exact: true })
    .fill(`upgrade-${Date.now()}@example.test`);
  await first
    .getByLabel("Password · 12+ characters")
    .fill("Guest-upgrade-secret-123");
  await first
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    first.getByRole("heading", { name: "Registered operator" }),
  ).toBeVisible();
  await first.getByRole("button", { name: "Operations", exact: true }).click();
  await expect(first.getByText("1/20 mastery", { exact: true })).toBeVisible();
  await context.close();
});

/** Browser-only smoke for the real styleguide/login shell; never mocks game settlement. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results", { recursive: true });
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("http://localhost:5173/styleguide");
  await page.getByRole("heading", { name: "The arcane dossier" }).waitFor();
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error(`Horizontal overflow at ${width}`);
  await page.screenshot({
    path: `test-results/styleguide-${width}.png`,
    fullPage: true,
  });
}
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Styleguide renders at 1440px and 390px without overflow or runtime errors.",
);

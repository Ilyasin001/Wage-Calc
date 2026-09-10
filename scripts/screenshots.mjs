/**
 * Captures the README screenshots from the demo dataset.
 *
 *   rm -f demo.db
 *   DATABASE_URL="file:./demo.db" npx prisma db push --url "file:./demo.db"
 *   DATABASE_URL="file:./demo.db" npx tsx scripts/demo-seed.ts
 *   DATABASE_URL="file:./demo.db" npx next dev --port 3002      # separate terminal
 *   node scripts/screenshots.mjs
 *
 * Shot at a phone viewport because the app is phone-first. Everything shown
 * is fictional demo data — see scripts/demo-seed.ts. Real payroll data is
 * never used for screenshots.
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3002";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["Pixel 5"],
  deviceScaleFactor: 2, // crisp on high-density displays
});
const page = await context.newPage();

async function shot(name) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}.png`);
}

await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill("demo@wagecalc.local");
await page.getByLabel("Password").fill("demo-password");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(`${BASE}/`);

console.log("capturing:");
await shot("home");

await page.goto(`${BASE}/payments?from=2026-09-07&to=2026-09-10`);
await shot("payments");

await page.goto(`${BASE}/staff`);
await shot("staff");

// The two-batch shift is the feature that defines the app. Navigating by id
// rather than clicking through keeps the capture deterministic.
const shiftId = process.env.SHOT_SHIFT_ID;
if (!shiftId) throw new Error("SHOT_SHIFT_ID not set");

await page.goto(`${BASE}/shifts/${shiftId}`);
await shot("shift-detail");

await page.goto(`${BASE}/shifts/${shiftId}/edit`);
// Open one staff row so the per-person controls are visible.
await page.getByRole("button", { name: /^Edit / }).first().click();
await page.waitForTimeout(400);
await shot("shift-editor");

await browser.close();
console.log("done");

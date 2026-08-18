import { expect, test } from "@playwright/test";

/**
 * Critical-flow E2E suite (spec §8): one serial journey through the app —
 * auth, staff, shift creation with live totals, clash rejection, payments
 * with double-payment protection, paid locking, revert, and reports.
 */

const EMAIL = "e2e@wagecalc.local";
const PASSWORD = "e2e-password-123";

/** Set by the first create test; the suite is serial so later tests reuse it. */
let todaysShiftUrl = "";

/**
 * Date n days from today as YYYY-MM-DD, in LOCAL time.
 *
 * toISOString() would format in UTC, which is a day behind local time during
 * BST for anything after 23:00 — the app files shifts by London date, so the
 * two must agree.
 */
function dayAfter(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as the app files it (London date). */
function today(): string {
  return dayAfter(0);
}

test.describe.configure({ mode: "serial" });

test("rejects a wrong password with a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Sign-in failed")).toBeVisible();
});

test("blocks unauthenticated access to every screen", async ({ page }) => {
  for (const route of ["/", "/payments", "/history", "/staff", "/settings"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("signs in and lands on home", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Recent Shifts" }),
  ).toBeVisible();
});

test.describe("authenticated journey", () => {
  // Sign in once per test via storage state would be cleaner; a serial suite
  // with a helper keeps it simple at this scale.
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    const email = page.getByLabel("Email");
    if (await email.isVisible().catch(() => false)) {
      await email.fill(EMAIL);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("**/");
    }
  });

  test("creates staff members", async ({ page }) => {
    for (const [name, role] of [
      ["Alice Test", "manager"],
      ["Bob Test", "regular"],
      ["Cara Test", "regular"],
    ] as const) {
      await page.goto("/staff/new");
      await page.getByLabel("Name").fill(name);
      await page.getByLabel("Role").selectOption(role);
      await page.getByRole("button", { name: "Add staff member" }).click();
      await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    }
  });

  test("creates a shift with one batch, bulk-added staff and a supervisor", async ({
    page,
  }) => {
    await page.goto("/shifts/new");
    // Inline new venue (D15) — with an empty venue list the form already
    // defaults to "Add New" mode, so just type the name.
    await page.getByPlaceholder("New venue name…").fill("E2E Arena");
    // Batch 1 defaults to the shift's 18:00–23:00; rates seeded £12/£15.
    // All three staff are added in a single pass through the picker.
    await page.getByRole("button", { name: "Add staff to this batch" }).click();
    await page.getByRole("button", { name: "Select all 3" }).click();
    await page.getByRole("button", { name: /Add 3 to batch/ }).click();

    // Make Alice supervisor — her break flips to 0, so she works 5h not 4h.
    await page.getByRole("button", { name: "Edit Alice Test" }).click();
    await page
      .getByRole("checkbox", { name: "Alice Test is supervisor" })
      .check();
    // Live total: Alice 5h×£15=75, Bob/Cara 4h×£12=48 each → £171
    await expect(page.getByText("Est. Total Pay").locator("..")).toContainText(
      "£171.00",
    );
    await page.getByRole("button", { name: "Save Shift" }).click();
    // Must land on the saved shift's detail page — NOT stay on /shifts/new.
    await expect(page).toHaveURL(/\/shifts\/(?!new$)[a-z0-9]+$/);
    await expect(page.getByText("Shift total").locator("..")).toContainText(
      "£171.00",
    );
    await expect(page.getByText("3 staff · 1 batch")).toBeVisible();
    // Later tests act on this exact shift; the suite creates several.
    todaysShiftUrl = page.url();
  });

  test("rejects a clashing second shift with a named error", async ({
    page,
  }) => {
    await page.goto("/shifts/new");
    await page.locator("select").first().selectOption({ label: "E2E Arena" });
    await page.getByRole("button", { name: "Add staff to this batch" }).click();
    await page.getByRole("button", { name: "Bob Test" }).click();
    await page.getByRole("button", { name: /Add 1 to batch/ }).click();
    await page.getByRole("button", { name: "Edit Bob Test" }).click();
    await page
      .getByRole("checkbox", { name: "Bob Test is supervisor" })
      .check();
    await page.getByRole("button", { name: "Save Shift" }).click();
    await expect(
      page.getByText(/Bob Test is already on the shift at E2E Arena/),
    ).toBeVisible();
  });

  test("a second batch can run different times within the shift", async ({
    page,
  }) => {
    await page.goto("/shifts/new");
    await page.locator("select").first().selectOption({ label: "E2E Arena" });
    // A later date — the suite is serial and these staff already worked
    // today's shift, which would trip the clash rule (D10).
    await page.getByLabel("Date").fill(dayAfter(1));
    // Shift 12:00–21:00 so the two batches fit inside it.
    await page.getByLabel("Shift Start").fill("12:00");
    await page.getByLabel("Shift Finish").fill("21:00");

    // Batch 1: 12:00–19:00, Alice (supervisor).
    await page.getByLabel("Batch Start").first().fill("12:00");
    await page.getByLabel("Batch Finish").first().fill("19:00");
    await page
      .getByRole("button", { name: "Add staff to this batch" })
      .first()
      .click();
    await page.getByRole("button", { name: "Alice Test" }).click();
    await page.getByRole("button", { name: /Add 1 to batch/ }).click();
    await page.getByRole("button", { name: "Edit Alice Test" }).click();
    await page
      .getByRole("checkbox", { name: "Alice Test is supervisor" })
      .check();

    // Batch 2: 14:00–21:00, Bob and Cara.
    await page.getByRole("button", { name: "Add another batch" }).click();
    await page.getByLabel("Batch Start").nth(1).fill("14:00");
    await page.getByLabel("Batch Finish").nth(1).fill("21:00");
    await page
      .getByRole("button", { name: "Add staff to this batch" })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Select all 2" }).click();
    await page.getByRole("button", { name: /Add 2 to batch/ }).click();

    // Alice 12:00–19:00 no break = 7h × £15 = £105.
    // Bob/Cara 14:00–21:00 less 60m = 6h × £12 = £72 each.
    await expect(page.getByText("Est. Total Pay").locator("..")).toContainText(
      "£249.00",
    );
    await page.getByRole("button", { name: "Save Shift" }).click();
    await expect(page).toHaveURL(/\/shifts\/(?!new$)[a-z0-9]+$/);
    await expect(page.getByText("3 staff · 2 batches")).toBeVisible();
    await expect(page.getByText("Batch 1")).toBeVisible();
    await expect(page.getByText("Batch 2")).toBeVisible();
  });

  test("rejects a batch that runs outside the shift window", async ({
    page,
  }) => {
    await page.goto("/shifts/new");
    await page.locator("select").first().selectOption({ label: "E2E Arena" });
    await page.getByLabel("Date").fill(dayAfter(2));
    await page.getByLabel("Shift Start").fill("12:00");
    await page.getByLabel("Shift Finish").fill("18:00");
    // Batch finishes an hour after the shift does.
    await page.getByLabel("Batch Start").first().fill("12:00");
    await page.getByLabel("Batch Finish").first().fill("19:00");
    await page.getByRole("button", { name: "Add staff to this batch" }).click();
    await page.getByRole("button", { name: "Cara Test" }).click();
    await page.getByRole("button", { name: /Add 1 to batch/ }).click();
    await page.getByRole("button", { name: "Edit Cara Test" }).click();
    await page
      .getByRole("checkbox", { name: "Cara Test is supervisor" })
      .check();
    await page.getByRole("button", { name: "Save Shift" }).click();
    await expect(
      page.getByText(/outside the shift's own start and finish/),
    ).toBeVisible();
  });

  test("payments: owed-only list, mark paid, double-payment protection", async ({
    page,
  }) => {
    const todayStr = today();
    await page.goto(`/payments?from=${todayStr}&to=${todayStr}`);
    await expect(page.getByText(/Total Outstanding · 3 staff/)).toBeVisible();
    await expect(page.getByText("£171.00").first()).toBeVisible();

    const aliceCard = page
      .locator("article")
      .filter({ hasText: "Alice Test" });
    await aliceCard.getByRole("button", { name: "Pay" }).click();
    await aliceCard
      .getByRole("button", { name: /Confirm £75\.00 paid/ })
      .click();
    // Alice disappears; total drops to £96 (48+48)
    await expect(page.getByText("Alice Test")).toHaveCount(0);
    await expect(page.getByText(/Total Outstanding · 2 staff/)).toBeVisible();
    await expect(page.getByText("£96.00").first()).toBeVisible();
  });

  test("paid entries are locked in the editor and block deletion", async ({
    page,
  }) => {
    await page.goto(todaysShiftUrl);
    await expect(
      page.getByText("This shift has paid entries, so it cannot be deleted."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/edit$/);
    const aliceRow = page.locator("li").filter({ hasText: "Alice Test" });
    await expect(aliceRow.getByText(/Paid — locked/i)).toBeVisible();
    // Her editor panel opens read-only.
    await page.getByRole("button", { name: "Edit Alice Test" }).click();
    await expect(
      page.getByRole("checkbox", { name: "Alice Test is supervisor" }),
    ).toBeDisabled();
  });

  test("revert to unpaid restores editability and deletion", async ({
    page,
  }) => {
    await page.goto(todaysShiftUrl);
    await page.getByRole("button", { name: "Paid", exact: true }).click();
    await page.getByRole("button", { name: "Revert to unpaid" }).click();
    await expect(
      page.getByRole("button", { name: "Delete shift" }),
    ).toBeVisible();
  });

  test("report endpoint returns a PDF and no longer offers Excel", async ({
    page,
  }) => {
    const todayStr = today();
    const pdf = await page.request.get(
      `/api/reports?from=${todayStr}&to=${todayStr}`,
    );
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).length).toBeGreaterThan(1000);

    // The Excel export was removed; the page offers PDF only.
    await page.goto(`/reports?from=${todayStr}&to=${todayStr}`);
    await expect(
      page.getByRole("link", { name: /Download PDF/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Excel/ })).toHaveCount(0);
  });

  test("staff deactivate and reactivate from the roster", async ({ page }) => {
    await page.goto("/staff");
    const activeTab = page.getByRole("tab", { name: /^Active/ });
    const inactiveTab = page.getByRole("tab", { name: /^Inactive/ });

    await expect(activeTab).toContainText("Active (3)");
    await page
      .getByRole("button", { name: "Deactivate Cara Test" })
      .click();

    // Leaves the Active tab, appears under Inactive.
    await expect(activeTab).toContainText("Active (2)");
    await expect(page.getByText("Cara Test")).toHaveCount(0);
    await inactiveTab.click();
    await expect(page.getByText("Cara Test")).toBeVisible();

    await page
      .getByRole("button", { name: "Reactivate Cara Test" })
      .click();
    await expect(activeTab).toContainText("Active (3)");
    await activeTab.click();
    await expect(page.getByText("Cara Test")).toBeVisible();
  });

  test("staff detail page still edits name and role", async ({ page }) => {
    await page.goto("/staff");
    await page.getByRole("link", { name: "Edit Bob Test" }).click();
    await page.waitForURL(/\/staff\/[a-z0-9]+$/);
    await page.getByLabel("Name").fill("Bob Tester");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.getByText("Bob Tester")).toBeVisible();
  });
});

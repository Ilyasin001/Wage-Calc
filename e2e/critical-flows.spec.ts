import { expect, test } from "@playwright/test";

/**
 * Critical-flow E2E suite (spec §8): one serial journey through the app —
 * auth, staff, shift creation with live totals, clash rejection, payments
 * with double-payment protection, paid locking, revert, and reports.
 */

const EMAIL = "e2e@wagecalc.local";
const PASSWORD = "e2e-password-123";

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

  test("creates a shift with inline venue, supervisor break flip, live total", async ({
    page,
  }) => {
    await page.goto("/shifts/new");
    // Inline new venue (D15) — with an empty venue list the form already
    // defaults to "Add New" mode, so just type the name.
    await page.getByPlaceholder("New venue name…").fill("E2E Arena");
    // 18:00–23:00 defaults, rates seeded £12/£15. Adding staff goes through
    // the roster search.
    const search = page.getByPlaceholder("Search active roster…");
    for (const name of ["Alice Test", "Bob Test", "Cara Test"]) {
      await search.fill(name.split(" ")[0]);
      await page.getByRole("button", { name: `${name} + Add` }).click();
    }
    // Make Alice supervisor — her break flips to 0 so she has 5h
    await page
      .getByRole("checkbox", { name: "Alice Test is supervisor" })
      .check();
    // Live total: Alice 5h×£15=75, Bob/Cara 4h×£12=48 → £171
    await expect(page.getByText("Est. Total Pay").locator("..")).toContainText(
      "£171.00",
    );
    await page.getByRole("button", { name: "Save Shift" }).click();
    // Must land on the saved shift's detail page — NOT stay on /shifts/new.
    await expect(page).toHaveURL(/\/shifts\/(?!new$)[a-z0-9]+$/);
    await expect(page.getByText("Shift total").locator("..")).toContainText(
      "£171.00",
    );
  });

  test("rejects a clashing second shift with a named error", async ({
    page,
  }) => {
    await page.goto("/shifts/new");
    await page.locator("select").first().selectOption({ label: "E2E Arena" });
    await page.getByPlaceholder("Search active roster…").fill("Bob");
    await page.getByRole("button", { name: "Bob Test + Add" }).click();
    await page
      .getByRole("checkbox", { name: "Bob Test is supervisor" })
      .check();
    await page.getByRole("button", { name: "Save Shift" }).click();
    await expect(
      page.getByText(/Bob Test is already on the shift at E2E Arena/),
    ).toBeVisible();
  });

  test("payments: owed-only list, mark paid, double-payment protection", async ({
    page,
  }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`/payments?from=${today}&to=${today}`);
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
    await page.goto("/history");
    await page.getByRole("link", { name: /E2E Arena/ }).first().click();
    await expect(
      page.getByText("This shift has paid entries, so it cannot be deleted."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/edit$/);
    const aliceCard = page
      .locator("article")
      .filter({ hasText: "Alice Test" });
    await expect(aliceCard.getByText(/Paid — Locked/i)).toBeVisible();
    // Inputs inside the disabled fieldset must not be editable.
    await expect(aliceCard.locator("input[type=time]").first()).toBeDisabled();
  });

  test("revert to unpaid restores editability and deletion", async ({
    page,
  }) => {
    await page.goto("/history");
    await page.getByRole("link", { name: /E2E Arena/ }).first().click();
    await page.getByRole("button", { name: "Paid", exact: true }).click();
    await page.getByRole("button", { name: "Revert to unpaid" }).click();
    await expect(
      page.getByRole("button", { name: "Delete shift" }),
    ).toBeVisible();
  });

  test("report endpoints return PDF and XLSX", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const pdf = await page.request.get(
      `/api/reports?from=${today}&to=${today}&format=pdf`,
    );
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).length).toBeGreaterThan(1000);

    const xlsx = await page.request.get(
      `/api/reports?from=${today}&to=${today}&format=xlsx`,
    );
    expect(xlsx.status()).toBe(200);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
    expect((await xlsx.body()).length).toBeGreaterThan(1000);
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

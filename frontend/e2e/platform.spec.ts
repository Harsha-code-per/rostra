import { expect, test } from "@playwright/test";
import { OWNER, signIn } from "./helpers";

test("platform owner creates a workspace; suspending it locks the admin out", async ({ page }) => {
  const adminEmail = `boss.${Date.now()}@example.com`;
  await signIn(page, OWNER, "/platform-admin/login");
  await expect(page).toHaveURL(/platform-admin$/);

  await page.getByRole("button", { name: "New workspace" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Company name").fill("Suspend Me Ltd");
  await dialog.getByLabel("Admin name").fill("Sam Boss");
  await dialog.getByLabel("Admin email").fill(adminEmail);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  const ready = page.getByRole("dialog", { name: /Workspace ready/ });
  const password = (await ready.locator("strong.select-all").innerText()).trim();
  await ready.getByRole("button", { name: "Done" }).click();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Suspend Suspend Me Ltd" }).click();
  await expect(page.getByRole("button", { name: "Reactivate Suspend Me Ltd" })).toBeVisible();

  await page.evaluate(() => localStorage.clear());
  await signIn(page, { email: adminEmail, password });
  await expect(page.getByText(/workspace is suspended/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("non-platform users are turned away from the console", async ({ page }) => {
  await signIn(page, { email: "alex.rivera@demo.example.com", password: "password123" }, "/platform-admin/login");
  await expect(page.getByText(/restricted to Rostra platform staff/)).toBeVisible();
});

test("the platform owner cannot use the customer sign-in", async ({ page }) => {
  await signIn(page, OWNER);
  await expect(page.getByText(/Platform staff sign in at/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

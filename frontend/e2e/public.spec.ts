import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, signIn } from "./helpers";

test("landing page tells the story and links to contact @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Count everyone in.");
  await expect(page.getByRole("heading", { name: /afternoons back/i })).toBeAttached();
  await expect(page.getByRole("link", { name: "Request a workspace" }).first()).toHaveAttribute("href", "/contact");
});

test("landing page has no horizontal scroll @mobile", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("landing demos work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Check in" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByRole("button", { name: "Check out" })).toBeVisible();
  await page.getByRole("button", { name: "Approve Priya's request" }).click();
  await expect(page.getByText("2 days approved")).toBeVisible();
  await page.getByLabel(/Monthly gross/).fill("100000");
  await expect(page.getByText("₹93,800")).toBeVisible();
});

test("landing, login, contact and reset pages pass axe @mobile", async ({ page }) => {
  for (const path of ["/", "/login", "/contact", "/forgot-password"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expectNoA11yViolations(page);
  }
});

test("wrong password shows the error and stays on login", async ({ page }) => {
  await signIn(page, { email: "admin@demo.example.com", password: "not-the-password" });
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("dashboard redirects to login when signed out", async ({ page }) => {
  await page.goto("/dashboard/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("contact form creates an inquiry", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Company").fill("Acme E2E");
  await page.getByLabel("Your name").fill("Pat Tester");
  await page.getByLabel("Work email").fill(`pat-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Request my workspace" }).click();
  await expect(page.getByRole("heading", { name: /we have it/i })).toBeVisible();
});

test("sidebar collapses to a rail without a scrollbar and the logo re-opens it", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill("admin@demo.example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard/);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  const nav = page.locator("aside nav");
  expect(await nav.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
  await page.getByRole("link", { name: "Employees" }).hover();
  await expect(page.locator("span[role=presentation]", { hasText: "Employees" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
});

test("unknown page shows the 404", async ({ page }) => {
  await page.goto("/definitely-not-here");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

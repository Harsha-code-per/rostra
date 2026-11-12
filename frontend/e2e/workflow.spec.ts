import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE, expectNoA11yViolations, signInOk as signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const newbie = { email: `jo.${stamp}@example.com`, first: "Jo", last: "Newhire", code: `E2E-${String(stamp).slice(-6)}` };
let tempPassword = "";

test("admin onboards an employee and gets a one-time password", async ({ page }) => {
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(/dashboard\/admin/);
  await expect(page.getByText("Total staff")).toBeVisible();

  await page.goto("/dashboard/admin/employees");
  await page.getByRole("button", { name: "Onboard employee" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name").fill(newbie.first);
  await dialog.getByLabel("Last name").fill(newbie.last);
  await dialog.getByLabel("Work email").fill(newbie.email);
  await dialog.getByLabel("Department").fill("Support");
  await dialog.getByLabel("Job title").fill("Agent");
  await dialog.getByLabel("Employee ID").fill(newbie.code);
  await dialog.getByRole("button", { name: "Onboard" }).click();

  const creds = page.getByRole("dialog", { name: /sign-in details/i });
  await expect(creds).toBeVisible();
  tempPassword = (await creds.locator("strong.select-all").innerText()).trim();
  expect(tempPassword.length).toBeGreaterThan(12);
  await creds.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(`${newbie.first} ${newbie.last}`)).toBeVisible();
});

test("new hire must set a password, and the session survives it", async ({ page }) => {
  await signIn(page, { email: newbie.email, password: tempPassword });
  await expect(page).toHaveURL(/force-password-reset/);
  await page.getByLabel("Temporary password").fill(tempPassword);
  await page.getByLabel("New password", { exact: true }).fill("Brand#NewPass9");
  await page.getByLabel("Confirm new password").fill("Brand#NewPass9");
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page).toHaveURL(/dashboard\/employee/);
  // Regression: the old client kept a dead token here and every call then failed with 401.
  await expect(page.getByRole("heading", { name: `Hello, ${newbie.first}` })).toBeVisible();
  await expect(page.getByText("Could not load")).toHaveCount(0);
});

test("employee checks in, then asks for leave", async ({ page }) => {
  await signIn(page, { email: newbie.email, password: "Brand#NewPass9" });
  await expect(page).toHaveURL(/dashboard\/employee/);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByRole("button", { name: "Check out" })).toBeVisible();

  await page.getByRole("button", { name: "Apply for leave" }).click();
  const dialog = page.getByRole("dialog");
  const start = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10);
  await dialog.getByLabel("From").fill(start);
  await dialog.getByLabel("To").fill(end);
  await dialog.getByLabel("Reason").fill("E2E family event");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Leave request sent to HR")).toBeVisible();
});

test("admin approves it and the employee sees the decision", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/dashboard/admin/leaves");
  const card = page.locator("div", { hasText: `${newbie.first} ${newbie.last}` }).filter({ has: page.getByRole("button", { name: /Review/ }) }).last();
  await card.getByRole("button", { name: /Review/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Request approved")).toBeVisible();

  await page.evaluate(() => localStorage.clear());
  await signIn(page, { email: newbie.email, password: "Brand#NewPass9" });
  await page.goto("/dashboard/employee/leaves");
  await expect(page.getByRole("cell", { name: "APPROVED" })).toBeVisible();
});

test("employees cannot open the admin area", async ({ page }) => {
  await signIn(page, EMPLOYEE);
  await expect(page).toHaveURL(/dashboard\/employee/);
  await page.goto("/dashboard/admin");
  await expect(page).toHaveURL(/dashboard\/employee/);
});

test("signed-in pages pass axe", async ({ page }) => {
  await signIn(page, ADMIN);
  for (const path of ["/dashboard/admin", "/dashboard/admin/employees", "/dashboard/admin/attendance", "/dashboard/admin/leaves", "/dashboard/admin/payroll", "/dashboard/admin/analytics"]) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByText(/Loading|Calculating/)).toHaveCount(0, { timeout: 20_000 });
    await expectNoA11yViolations(page);
  }
  await page.evaluate(() => localStorage.clear());
  await signIn(page, EMPLOYEE);
  for (const path of ["/dashboard/employee", "/dashboard/employee/attendance", "/dashboard/employee/leaves", "/dashboard/employee/payroll", "/dashboard/employee/profile"]) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 20_000 });
    await expectNoA11yViolations(page);
  }
});

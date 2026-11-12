import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const ADMIN = { email: "admin@demo.example.com", password: "password123" };
export const EMPLOYEE = { email: "alex.rivera@demo.example.com", password: "password123" };
export const OWNER = { email: "owner@demo.example.com", password: "RostraPlatform#2026" };

export async function signIn(page: Page, who: { email: string; password: string }, path = "/login") {
  await page.goto(path);
  await page.getByLabel(/^(Work )?email$/i).fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function expectNoA11yViolations(page: Page) {
  // Scans must not catch entrance animations mid-fade.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(150);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.flatMap((v) =>
    v.nodes.slice(0, 4).map((n) => {
      const d = n.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
      const colors = d?.contrastRatio ? ` [${d.fgColor} on ${d.bgColor} = ${d.contrastRatio}]` : "";
      return `${v.id} (${v.impact}) ${page.url()} ${n.target.join(" ")}${colors}: ${n.html.slice(0, 90)}`;
    })
  );
  expect(summary, `Accessibility violations:\n${summary.join("\n")}`).toEqual([]);
}

/** Sign in and wait until the app has actually navigated away from the login screen. */
export async function signInOk(page: Page, who: { email: string; password: string }, path = "/login") {
  await signIn(page, who, path);
  await page.waitForURL(/dashboard|platform-admin$|force-password-reset/);
}

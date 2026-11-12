/** Published plans. The employee caps match PLAN_EMPLOYEE_LIMITS in the API; change both together. */
export type PlanName = "Starter" | "Growth" | "Enterprise";

export interface Plan {
  name: PlanName;
  price: string; // headline price
  per: string;
  cap: string;
  blurb: string;
  highlight?: boolean;
  cta: string;
}

export const PLANS: Plan[] = [
  { name: "Starter", price: "₹999", per: "per month", cap: "Up to 25 employees", blurb: "For a small team getting off spreadsheets." },
  { name: "Growth", price: "₹3,999", per: "per month", cap: "Up to 100 employees", blurb: "For a growing company with an HR team.", highlight: true },
  { name: "Enterprise", price: "Let's talk", per: "custom pricing", cap: "Unlimited employees", blurb: "For large teams with their own terms." },
].map((p) => ({ cta: p.name === "Enterprise" ? "Talk to us" : "Request a workspace", ...p })) as Plan[];

/** Everything every plan includes. */
export const INCLUDED = [
  "Attendance with one-tap check-in and out",
  "Leave requests, balances and approvals",
  "Payroll with Basic, HRA, PF and professional tax",
  "Payslip PDFs and CSV export",
  "Admin, HR and employee roles",
  "Your data sealed from every other company",
];

export const planLabel = (p: Plan) => `${p.name}: ${p.price === "Let's talk" ? "custom pricing" : `${p.price}/month`}, ${p.cap.toLowerCase()}`;

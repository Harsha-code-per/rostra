export interface SalaryComponents {
  wage: number;
  basic: number;
  hra: number;
  standardAllowance: number;
  performanceBonus: number;
  lta: number;
  fixedAllowance: number;
  grossSalary: number;
  pf: number;
  professionalTax: number;
  totalDeductions: number;
  netSalary: number;
}

export interface PayableSalaryResult {
  totalWorkingDays: number;
  totalWorkDays: number;
  payableDays: number;
  presentDays: number;
  approvedLeaves: number;
  unpaidDays: number;
  effectiveNetPayout: number;
  payableAmount: number;
}

/**
 * Dynamic Salary Calculation Engine matching the Rostra backend rules:
 * - Basic = 50% of Wage
 * - HRA = 50% of Basic (25% of Wage)
 * - Standard Allowance = ₹4,167 fixed
 * - Performance Bonus = 8.33% of Basic
 * - LTA = 8.33% of Basic
 * - Fixed Allowance = Wage - (Basic + HRA + Standard + Bonus + LTA) [balancing element]
 * - PF = 12% of Basic
 * - Professional Tax = ₹200 fixed
 * - Gross Salary = Sum of all earnings (Equals Wage)
 * - Total Deductions = PF + PT
 * - Net Salary = Gross - Total Deductions
 */
export function calculateSalaryStructure(wageInput: number | string): SalaryComponents {
  const wage = Math.max(0, Number(wageInput) || 0);

  const basic = Math.round(wage * 0.5 * 100) / 100;
  const hra = Math.round(basic * 0.5 * 100) / 100;
  const performanceBonus = Math.round(basic * 0.0833 * 100) / 100;
  const lta = Math.round(basic * 0.0833 * 100) / 100;

  // Mirrors the backend: components always add up to the wage; the standard allowance shrinks for very low wages.
  const standardAllowance = Math.min(4167.0, Math.round((wage - (basic + hra + performanceBonus + lta)) * 100) / 100);
  const grossSubtotal = basic + hra + standardAllowance + performanceBonus + lta;
  const fixedAllowance = Math.round((wage - grossSubtotal) * 100) / 100;

  const grossSalary = Math.round((basic + hra + standardAllowance + performanceBonus + lta + fixedAllowance) * 100) / 100;

  const pf = Math.round(basic * 0.12 * 100) / 100;
  const professionalTax = 200.0;
  const totalDeductions = Math.round((pf + professionalTax) * 100) / 100;

  const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

  return {
    wage,
    basic,
    hra,
    standardAllowance,
    performanceBonus,
    lta,
    fixedAllowance,
    grossSalary,
    pf,
    professionalTax,
    totalDeductions,
    netSalary,
  };
}

/**
 * Calculates effective monthly payout based on payable days.
 */
export function calculatePayablePayout(
  netSalary: number,
  totalWorkingDays: number = 22,
  presentDays: number = 21,
  paidLeaves: number = 1
): PayableSalaryResult {
  const payableDays = Math.min(totalWorkingDays, presentDays + paidLeaves);
  const unpaidDays = Math.max(0, totalWorkingDays - payableDays);
  const ratio = totalWorkingDays > 0 ? payableDays / totalWorkingDays : 1.0;
  const effectiveNetPayout = Math.round(netSalary * ratio * 100) / 100;

  return {
    totalWorkingDays,
    totalWorkDays: totalWorkingDays,
    payableDays,
    presentDays,
    approvedLeaves: paidLeaves,
    unpaidDays,
    effectiveNetPayout,
    payableAmount: effectiveNetPayout,
  };
}

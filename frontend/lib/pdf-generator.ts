import { jsPDF } from "jspdf";
import { Employee } from "./types";
import { SalaryComponents, PayableSalaryResult } from "./salary-calculator";
import { formatCurrency, formatDate } from "./utils";

export function generatePayslipPDF(
  employee: Employee,
  structure: SalaryComponents,
  payableSummary: PayableSalaryResult,
  monthYear: string
): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const primaryCyan = [6, 182, 212];
  const darkSlate = [15, 23, 42];
  const textMuted = [100, 116, 139];

  // 1. Header Banner
  doc.setFillColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.rect(0, 0, 210, 38, "F");

  // Cyan Accent Line
  doc.setFillColor(primaryCyan[0], primaryCyan[1], primaryCyan[2]);
  doc.rect(0, 38, 210, 2, "F");

  // Brand Name & Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("ROSTRA", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(primaryCyan[0], primaryCyan[1], primaryCyan[2]);
  doc.text("PEOPLE & PAYROLL", 14, 25);

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(`SALARY SLIP — ${monthYear.toUpperCase()}`, 196, 20, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on: ${formatDate(new Date())}`, 196, 27, { align: "right" });

  // 2. Employee Details Box
  let y = 48;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 182, 34, 2, 2, "FD");

  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Employee Name:", 18, y + 8);
  doc.setFont("helvetica", "normal");
  doc.text(`${employee.firstName} ${employee.lastName}`, 54, y + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Employee ID:", 18, y + 16);
  doc.setFont("helvetica", "normal");
  doc.text(employee.employeeId, 54, y + 16);

  doc.setFont("helvetica", "bold");
  doc.text("Department:", 18, y + 24);
  doc.setFont("helvetica", "normal");
  doc.text(employee.department, 54, y + 24);

  doc.setFont("helvetica", "bold");
  doc.text("Designation:", 110, y + 8);
  doc.setFont("helvetica", "normal");
  doc.text(employee.designation, 140, y + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Joining Date:", 110, y + 16);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(employee.joiningDate), 140, y + 16);

  doc.setFont("helvetica", "bold");
  doc.text("Email:", 110, y + 24);
  doc.setFont("helvetica", "normal");
  doc.text(employee.email, 140, y + 24);

  // 3. Attendance & Payable Days Summary
  y = 90;
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(14, y, 182, 16, 2, 2, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Total Working Days: ${payableSummary.totalWorkingDays}`, 20, y + 10);
  doc.text(`Payable Days: ${payableSummary.payableDays}`, 85, y + 10);
  doc.text(`Unpaid Leaves: ${payableSummary.unpaidDays}`, 145, y + 10);

  // 4. Earnings & Deductions Tables
  y = 114;

  // Earnings Table Header
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, 88, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("EARNINGS", 18, y + 5.5);
  doc.text("AMOUNT (INR)", 98, y + 5.5, { align: "right" });

  // Deductions Table Header
  doc.setFillColor(15, 23, 42);
  doc.rect(108, y, 88, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.text("DEDUCTIONS", 112, y + 5.5);
  doc.text("AMOUNT (INR)", 192, y + 5.5, { align: "right" });

  // Table Body Rows
  y += 8;
  const earningsList = [
    { label: "Basic Salary (50%)", amount: structure.basic },
    { label: "House Rent Allowance (HRA)", amount: structure.hra },
    { label: "Standard Allowance", amount: structure.standardAllowance },
    { label: "Performance Bonus", amount: structure.performanceBonus },
    { label: "Leave Travel Allowance (LTA)", amount: structure.lta },
    { label: "Fixed Allowance (Residual)", amount: structure.fixedAllowance },
  ];

  const deductionsList = [
    { label: "Provident Fund (PF - 12%)", amount: structure.pf },
    { label: "Professional Tax (PT)", amount: structure.professionalTax },
  ];

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

  const maxRows = Math.max(earningsList.length, deductionsList.length);
  const rowH = 7.5;

  for (let i = 0; i < maxRows; i++) {
    const rowY = y + i * rowH;
    const bg = i % 2 === 0 ? 255 : 248;

    // Earnings cell
    doc.setFillColor(bg, bg, bg);
    doc.rect(14, rowY, 88, rowH, "F");
    if (earningsList[i]) {
      doc.text(earningsList[i].label, 18, rowY + 5);
      doc.text(formatCurrency(earningsList[i].amount), 98, rowY + 5, { align: "right" });
    }

    // Deductions cell
    doc.setFillColor(bg, bg, bg);
    doc.rect(108, rowY, 88, rowH, "F");
    if (deductionsList[i]) {
      doc.text(deductionsList[i].label, 112, rowY + 5);
      doc.text(formatCurrency(deductionsList[i].amount), 192, rowY + 5, { align: "right" });
    }
  }

  // Totals Row
  y = y + maxRows * rowH;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 88, 9, "F");
  doc.rect(108, y, 88, 9, "F");

  doc.setFont("helvetica", "bold");
  doc.text("GROSS EARNINGS", 18, y + 6);
  doc.text(formatCurrency(structure.grossSalary), 98, y + 6, { align: "right" });

  doc.text("TOTAL DEDUCTIONS", 112, y + 6);
  doc.text(formatCurrency(structure.totalDeductions), 192, y + 6, { align: "right" });

  // 5. Net Salary Highlight Banner
  y += 18;
  doc.setFillColor(6, 182, 212);
  doc.roundedRect(14, y, 182, 22, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("NET SALARY PAYABLE", 22, y + 9);

  doc.setFontSize(16);
  doc.text(formatCurrency(payableSummary.effectiveNetPayout), 22, y + 17);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Monthly Base Wage CTC: ${formatCurrency(structure.wage)}`, 190, y + 13, { align: "right" });

  // 6. Signatures & Footer
  y = 245;
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFontSize(8);
  doc.text("This is a computer-generated salary statement from Rostra and requires no physical signature.", 105, y, { align: "center" });

  doc.setDrawColor(203, 213, 225);
  doc.line(24, y + 20, 74, y + 20);
  doc.line(136, y + 20, 186, y + 20);

  doc.text("Employee Signature", 49, y + 25, { align: "center" });
  doc.text("Authorised HR Signatory", 161, y + 25, { align: "center" });

  // Save PDF
  doc.save(`Rostra_Payslip_${employee.employeeId}_${monthYear.replace(" ", "_")}.pdf`);
}

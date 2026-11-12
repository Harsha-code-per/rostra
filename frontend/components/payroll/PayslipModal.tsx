"use client";

import React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { Employee } from "@/lib/types";
import type { PayableSalaryResult, SalaryComponents } from "@/lib/salary-calculator";
import { formatCurrency, periodLabel } from "@/lib/utils";
import { Dialog } from "@/components/shared/Dialog";

interface Props {
  employee: Employee;
  structure: SalaryComponents;
  payableSummary: PayableSalaryResult;
  month: number;
  year: number;
  isOpen: boolean;
  onClose: () => void;
}

const Row = ({ label, value, negative }: { label: string; value: number; negative?: boolean }) => (
  <div className="flex justify-between">
    <dt className="text-slate-700">{label}</dt>
    <dd className={`font-mono font-bold ${negative ? "text-rose-700" : "text-slate-900"}`}>{negative ? "−" : ""}{formatCurrency(value)}</dd>
  </div>
);

export function PayslipModal({ employee, structure: s, payableSummary: p, month, year, isOpen, onClose }: Props) {
  if (!isOpen) return null;
  const period = periodLabel(month, year);

  const download = async () => {
    try {
      // jsPDF is large; load it only when someone actually downloads a payslip.
      const { generatePayslipPDF } = await import("@/lib/pdf-generator");
      generatePayslipPDF(employee, s, p, period);
    } catch {
      toast.error("Could not generate the PDF");
    }
  };

  return (
    <Dialog title="Salary statement" description={`Pay period: ${period}`} onClose={onClose} className="max-w-2xl">
      <div className="flex justify-end mb-4">
        <button onClick={download} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
          <Download className="w-4 h-4" aria-hidden="true" /> Download PDF
        </button>
      </div>
      <p className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm mb-4">
        <strong>{employee.firstName} {employee.lastName}</strong> · {employee.employeeId} · {employee.department} · {employee.designation}
        <br />
        <span className="text-slate-700">Payable days: <strong className="font-mono">{p.payableDays} / {p.totalWorkDays}</strong> (present {p.presentDays}, paid leave {p.approvedLeaves})</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="p-4 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-cyan-900 mb-2 pb-1 border-b border-slate-100">Earnings</h3>
          <dl className="flex flex-col gap-2">
            <Row label="Basic" value={s.basic} />
            <Row label="House rent allowance" value={s.hra} />
            <Row label="Standard allowance" value={s.standardAllowance} />
            <Row label="Performance bonus" value={s.performanceBonus} />
            <Row label="Leave travel allowance" value={s.lta} />
            <Row label="Fixed allowance" value={s.fixedAllowance} />
            <Row label="Gross" value={s.grossSalary} />
          </dl>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-rose-800 mb-2 pb-1 border-b border-slate-100">Deductions</h3>
          <dl className="flex flex-col gap-2">
            <Row label="Provident fund (12%)" value={s.pf} negative />
            <Row label="Professional tax" value={s.professionalTax} negative />
            <Row label="Total deductions" value={s.totalDeductions} negative />
          </dl>
          <div className="mt-6 p-3.5 rounded-xl bg-cyan-50 border border-cyan-200">
            <p className="text-xs font-bold text-cyan-900">Net pay for {p.payableDays} payable days</p>
            <p className="text-2xl font-extrabold font-mono text-cyan-950">{formatCurrency(p.payableAmount)}</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

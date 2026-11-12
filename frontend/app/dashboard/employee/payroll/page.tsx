"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { RostraApi, type PayrollView } from "@/lib/api";
import { formatCurrency, periodLabel } from "@/lib/utils";
import { PayslipModal } from "@/components/payroll/PayslipModal";
import { inputClass } from "@/components/shared/AuthShell";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function EmployeePayrollPage() {
  const { user } = useAuth();
  const emp = user!.employee;
  const [period, setPeriod] = useState(thisMonth());
  const [data, setData] = useState<PayrollView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const [y, m] = period.split("-").map(Number);
    let cancelled = false;
    RostraApi.getEmployeePayroll(emp.id, m, y)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load payroll"));
    return () => {
      cancelled = true;
    };
  }, [emp.id, period]);

  const download = async () => {
    if (!data) return;
    try {
      const { generatePayslipPDF } = await import("@/lib/pdf-generator");
      generatePayslipPDF(emp, data.structure, data.payableSummary, periodLabel(data.month, data.year));
    } catch {
      toast.error("Could not generate the PDF");
    }
  };

  const s = data?.structure;
  const p = data?.payableSummary;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">Salary &amp; payslips</h1>
          <p className="text-sm text-slate-600">Your pay, calculated from attendance and approved leave.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="period" className="block text-sm font-semibold text-slate-800 mb-1.5">Month</label>
            <input id="period" type="month" max={thisMonth()} value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} className={inputClass} />
          </div>
          <button onClick={() => setOpen(true)} disabled={!data} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
            <FileText className="w-4 h-4" aria-hidden="true" /> View statement
          </button>
          <button onClick={download} disabled={!data} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
            <Download className="w-4 h-4" aria-hidden="true" /> Download PDF
          </button>
        </div>
      </div>

      {error && <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>}
      {!data && !error && <p role="status" className="text-sm text-slate-600">Loading payroll…</p>}

      {data && s && p && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Monthly gross</p>
              <p className="text-3xl font-extrabold font-mono mt-1">{formatCurrency(s.wage)}</p>
              <p className="text-xs text-slate-600 mt-1">{formatCurrency(s.wage * 12)} per year</p>
            </div>
            <div className="p-5 rounded-2xl bg-cyan-50/60 border border-cyan-200">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-900">Net pay, {periodLabel(data.month, data.year)}</p>
              <p className="text-3xl font-extrabold font-mono text-cyan-900 mt-1">{formatCurrency(p.payableAmount)}</p>
              <p className="text-xs text-slate-700 mt-1">{p.payableDays} payable of {p.totalWorkDays} working days</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Deductions (PF + PT)</p>
              <p className="text-3xl font-extrabold font-mono text-rose-700 mt-1">−{formatCurrency(s.totalDeductions)}</p>
              <p className="text-xs text-slate-600 mt-1">PF {formatCurrency(s.pf)} · PT {formatCurrency(s.professionalTax)}</p>
            </div>
          </div>
          <p className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-800">
            Payable days = {p.presentDays} present + {p.approvedLeaves} paid leave = {p.payableDays} of {p.totalWorkDays} working days
            {p.unpaidDays > 0 ? `, ${p.unpaidDays} unpaid` : ""}.
          </p>
          <PayslipModal employee={emp} structure={s} payableSummary={p} month={data.month} year={data.year} isOpen={open} onClose={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}

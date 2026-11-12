"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, Edit3, FileText } from "lucide-react";
import { RostraApi, type PayrollView } from "@/lib/api";
import type { Employee } from "@/lib/types";
import { formatCurrency, periodLabel } from "@/lib/utils";
import { SalaryStructureEditor } from "@/components/payroll/SalaryStructureEditor";
import { PayslipModal } from "@/components/payroll/PayslipModal";
import { AvatarBadge } from "@/components/shared/AvatarBadge";
import { inputClass } from "@/components/shared/AuthShell";

type Row = { employee: Employee; payroll: PayrollView };
const thisMonth = () => new Date().toISOString().slice(0, 7);

function downloadRegister(rows: Row[], period: string) {
  const head = ["Employee ID", "Name", "Department", "Gross wage", "Payable days", "Working days", "Deductions", "Net pay"];
  const lines = rows.map(({ employee: e, payroll: p }) => [e.employeeId, `${e.firstName} ${e.lastName}`, e.department, p.structure.wage, p.payableSummary.payableDays, p.payableSummary.totalWorkDays, p.structure.totalDeductions, p.payableSummary.payableAmount]);
  const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  Object.assign(document.createElement("a"), { href: url, download: `rostra-payroll-${period}.csv` }).click();
  URL.revokeObjectURL(url);
}

export default function AdminPayrollPage() {
  const [period, setPeriod] = useState(thisMonth());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [slip, setSlip] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const [y, m] = period.split("-").map(Number);
    try {
      const employees = await RostraApi.getEmployees();
      // shortcut: one request per employee; add a bulk /payroll/register endpoint past ~100 employees.
      const payrolls = await Promise.all(employees.map((e) => RostraApi.getEmployeePayroll(e.id, m, y)));
      setRows(employees.map((employee, i) => ({ employee, payroll: payrolls[i] })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payroll");
    }
  }, [period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload when the month changes
    load();
  }, [load]);

  const totalNet = rows?.reduce((s, r) => s + r.payroll.payableSummary.payableAmount, 0) ?? 0;
  const totalGross = rows?.reduce((s, r) => s + r.payroll.structure.wage, 0) ?? 0;
  const totalDed = rows?.reduce((s, r) => s + r.payroll.structure.totalDeductions, 0) ?? 0;
  const [y, m] = period.split("-").map(Number);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">Payroll</h1>
          <p className="text-sm text-slate-600">Calculated from attendance and approved leave. Rostra does not move money; export the register for your bank.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="pay-month" className="block text-sm font-semibold text-slate-800 mb-1.5">Month</label>
            <input id="pay-month" type="month" max={thisMonth()} value={period} onChange={(e) => { if (e.target.value) { setRows(null); setPeriod(e.target.value); } }} className={inputClass} />
          </div>
          <button onClick={() => rows && downloadRegister(rows, period)} disabled={!rows?.length} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
            <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
          </button>
        </div>
      </div>

      {error && <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>}

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[["Gross payroll", totalGross], [`Net payable, ${periodLabel(m, y)}`, totalNet], ["Statutory deductions", totalDed]].map(([k, v]) => (
          <div key={k as string} className="p-5 rounded-2xl bg-white border border-slate-200">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-600">{k}</dt>
            <dd className="mt-1 text-2xl font-extrabold font-mono">{rows ? formatCurrency(v as number) : "…"}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-3xl bg-white border border-slate-200 overflow-x-auto">
        {!rows && !error ? (
          <p role="status" className="p-6 text-sm text-slate-600">Calculating payroll…</p>
        ) : rows && rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">No employees yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Payroll register for {periodLabel(m, y)}</caption>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <tr>
                <th scope="col" className="py-3.5 px-4 font-semibold">Employee</th>
                <th scope="col" className="py-3.5 font-semibold">Gross</th>
                <th scope="col" className="py-3.5 font-semibold">Payable days</th>
                <th scope="col" className="py-3.5 font-semibold">Net pay</th>
                <th scope="col" className="py-3.5 pr-4 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows?.map((r) => (
                <tr key={r.employee.id}>
                  <td className="py-3.5 px-4">
                    <span className="flex items-center gap-3">
                      <AvatarBadge name={`${r.employee.firstName} ${r.employee.lastName}`} department={r.employee.department} size="sm" />
                      <span><span className="font-bold block">{r.employee.firstName} {r.employee.lastName}</span><span className="text-xs text-slate-600 font-mono">{r.employee.employeeId}</span></span>
                    </span>
                  </td>
                  <td className="py-3.5 font-mono">{formatCurrency(r.payroll.structure.wage)}</td>
                  <td className="py-3.5 font-mono">{r.payroll.payableSummary.payableDays} / {r.payroll.payableSummary.totalWorkDays}</td>
                  <td className="py-3.5 font-mono font-bold text-cyan-900">{formatCurrency(r.payroll.payableSummary.payableAmount)}</td>
                  <td className="py-3.5 pr-4 text-right">
                    <span className="inline-flex gap-1.5">
                      <button onClick={() => setSlip(r)} aria-label={`Payslip for ${r.employee.firstName} ${r.employee.lastName}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-xs focus-visible:outline-2 focus-visible:outline-cyan-600"><FileText className="w-3.5 h-3.5" aria-hidden="true" /> Payslip</button>
                      <button onClick={() => setEditing(r.employee)} aria-label={`Edit salary for ${r.employee.firstName} ${r.employee.lastName}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-900 font-bold text-xs border border-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-600"><Edit3 className="w-3.5 h-3.5" aria-hidden="true" /> Salary</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SalaryStructureEditor employee={editing} isOpen={Boolean(editing)} onClose={() => setEditing(null)} onSaved={load} />
      {slip && <PayslipModal employee={slip.employee} structure={slip.payroll.structure} payableSummary={slip.payroll.payableSummary} month={slip.payroll.month} year={slip.payroll.year} isOpen onClose={() => setSlip(null)} />}
    </div>
  );
}

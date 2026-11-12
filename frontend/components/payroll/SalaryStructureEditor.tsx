"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import type { Employee } from "@/lib/types";
import { RostraApi } from "@/lib/api";
import { calculateSalaryStructure } from "@/lib/salary-calculator";
import { formatCurrency } from "@/lib/utils";
import { Dialog } from "@/components/shared/Dialog";
import { inputClass } from "@/components/shared/AuthShell";

interface Props {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const Row = ({ label, value, negative }: { label: string; value: number; negative?: boolean }) => (
  <div className="flex justify-between">
    <dt className="text-slate-700">{label}</dt>
    <dd className={`font-mono font-bold ${negative ? "text-rose-700" : "text-slate-900"}`}>{negative ? "−" : ""}{formatCurrency(value)}</dd>
  </div>
);

function Editor({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const [wage, setWage] = useState(String(employee.wage || ""));
  const [busy, setBusy] = useState(false);
  const value = Number(wage) || 0;
  const b = calculateSalaryStructure(value);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await RostraApi.updateEmployeeWage(employee.employeeId, value);
      toast.success(`Wage updated for ${employee.firstName} ${employee.lastName}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the salary");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div>
        <label htmlFor="wage" className="block text-sm font-semibold text-slate-800 mb-1.5">Monthly gross wage (₹)</label>
        <input id="wage" type="number" required min={1} max={100000000} step={1} value={wage} onChange={(e) => setWage(e.target.value)} aria-describedby="wage-hint" className={`${inputClass} font-mono text-lg font-bold`} />
        <p id="wage-hint" className="text-xs text-slate-600 mt-1">Every component below recalculates from this number.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm" aria-live="polite">
        <div className="p-4 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-cyan-900 mb-2 pb-1 border-b border-slate-100">Earnings</h3>
          <dl className="flex flex-col gap-2">
            <Row label="Basic (50%)" value={b.basic} />
            <Row label="HRA (50% of basic)" value={b.hra} />
            <Row label="Standard allowance" value={b.standardAllowance} />
            <Row label="Performance bonus" value={b.performanceBonus} />
            <Row label="LTA" value={b.lta} />
            <Row label="Fixed allowance" value={b.fixedAllowance} />
          </dl>
        </div>
        <div className="flex flex-col gap-3">
          <div className="p-4 rounded-2xl border border-slate-200">
            <h3 className="font-bold text-rose-800 mb-2 pb-1 border-b border-slate-100">Deductions</h3>
            <dl className="flex flex-col gap-2">
              <Row label="Provident fund (12%)" value={b.pf} negative />
              <Row label="Professional tax" value={b.professionalTax} negative />
            </dl>
          </div>
          <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-200">
            <p className="text-xs font-bold text-cyan-900">Net take-home</p>
            <p className="text-2xl font-extrabold font-mono text-cyan-950">{formatCurrency(b.netSalary)}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold focus-visible:outline-2 focus-visible:outline-cyan-600">Cancel</button>
        <button type="submit" disabled={busy || value <= 0} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
          <Save className="w-4 h-4" aria-hidden="true" /> {busy ? "Saving…" : "Save salary"}
        </button>
      </div>
    </form>
  );
}

export function SalaryStructureEditor({ employee, isOpen, onClose, onSaved }: Props) {
  if (!isOpen || !employee) return null;
  return (
    <Dialog title="Salary structure" description={`${employee.firstName} ${employee.lastName} · ${employee.employeeId} · ${employee.designation}`} onClose={onClose} className="max-w-2xl">
      <Editor employee={employee} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

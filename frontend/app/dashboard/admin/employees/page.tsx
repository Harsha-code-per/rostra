"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, IndianRupee, Edit3, KeyRound, Plus, Search } from "lucide-react";
import { RostraApi, type NewEmployeeInput } from "@/lib/api";
import type { Employee } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { EmployeeEditDrawer } from "@/components/employees/EmployeeEditDrawer";
import { SalaryStructureEditor } from "@/components/payroll/SalaryStructureEditor";
import { AvatarBadge } from "@/components/shared/AvatarBadge";
import { Dialog } from "@/components/shared/Dialog";
import { inputClass } from "@/components/shared/AuthShell";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-800 border-emerald-300",
  ON_LEAVE: "bg-purple-50 text-purple-800 border-purple-300",
  TERMINATED: "bg-rose-50 text-rose-800 border-rose-300",
};

function nextEmployeeCode(list: Employee[]): string {
  const max = list.reduce((m, e) => Math.max(m, Number(/(\d+)$/.exec(e.employeeId)?.[1] ?? 0)), 0);
  return `EMP-${String(max + 1).padStart(3, "0")}`;
}

function OnboardDialog({ code, onClose, onCreated }: { code: string; onClose: () => void; onCreated: (e: Employee, pass: string) => void }) {
  const [f, setF] = useState({ employeeId: code, firstName: "", lastName: "", email: "", phone: "", department: "", designation: "", wage: "50000", role: "EMPLOYEE" as "EMPLOYEE" | "HR" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const input: NewEmployeeInput = { ...f, wage: Number(f.wage) };
      const res = await RostraApi.createEmployee(input);
      onCreated(res.employee, res.temporaryPassword);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not onboard this person");
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: string, el: React.ReactNode) => (
    <div><label htmlFor={id} className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</label>{el}</div>
  );

  return (
    <Dialog title="Onboard a team member" description="Creates their login with a one-time password." onClose={onClose} className="max-w-lg">
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          {field("ob-first", "First name", <input id="ob-first" required maxLength={100} value={f.firstName} onChange={set("firstName")} className={inputClass} />)}
          {field("ob-last", "Last name", <input id="ob-last" required maxLength={100} value={f.lastName} onChange={set("lastName")} className={inputClass} />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("ob-email", "Work email", <input id="ob-email" type="email" required autoComplete="off" value={f.email} onChange={set("email")} className={inputClass} />)}
          {field("ob-phone", "Phone", <input id="ob-phone" type="tel" value={f.phone} onChange={set("phone")} className={inputClass} />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("ob-dept", "Department", <input id="ob-dept" required maxLength={100} value={f.department} onChange={set("department")} className={inputClass} />)}
          {field("ob-title", "Job title", <input id="ob-title" required maxLength={100} value={f.designation} onChange={set("designation")} className={inputClass} />)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field("ob-code", "Employee ID", <input id="ob-code" required maxLength={50} value={f.employeeId} onChange={set("employeeId")} className={`${inputClass} font-mono`} />)}
          {field("ob-wage", "Monthly wage (₹)", <input id="ob-wage" type="number" required min={1} step={1} value={f.wage} onChange={set("wage")} className={`${inputClass} font-mono`} />)}
          {field("ob-role", "Access", <select id="ob-role" value={f.role} onChange={set("role")} className={inputClass}><option value="EMPLOYEE">Employee</option><option value="HR">HR</option></select>)}
        </div>
        <div className="flex justify-end gap-2.5 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-sm focus-visible:outline-2 focus-visible:outline-cyan-600">Cancel</button>
          <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">{busy ? "Onboarding…" : "Onboard"}</button>
        </div>
      </form>
    </Dialog>
  );
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("ALL");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [salaryFor, setSalaryFor] = useState<Employee | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [credentials, setCredentials] = useState<{ employee: Employee; pass: string } | null>(null);

  const load = useCallback(() => {
    RostraApi.getEmployees()
      .then((e) => (setEmployees(e), setError(null)))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load employees"));
  }, []);

  useEffect(() => {
     
    load();
  }, [load]);

  const departments = useMemo(() => ["ALL", ...Array.from(new Set((employees ?? []).map((e) => e.department))).sort()], [employees]);
  const q = query.trim().toLowerCase();
  const filtered = (employees ?? []).filter(
    (e) => (dept === "ALL" || e.department === dept) && (!q || `${e.firstName} ${e.lastName} ${e.employeeId} ${e.designation} ${e.email}`.toLowerCase().includes(q))
  );

  const copyCredentials = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(`Email: ${credentials.employee.email}\nTemporary password: ${credentials.pass}\nSign in: ${window.location.origin}/login`);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed. Select the text and copy it manually.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">Employees</h1>
          <p className="text-sm text-slate-600">{employees ? `${employees.length} people` : "Loading…"}</p>
        </div>
        <button onClick={() => setOnboarding(true)} disabled={!employees} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
          <Plus className="w-4 h-4" aria-hidden="true" /> Onboard employee
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 p-4 rounded-3xl bg-white border border-slate-200">
        <div className="relative flex-1 min-w-[220px]">
          <label htmlFor="emp-search" className="sr-only">Search employees</label>
          <Search className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input id="emp-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID, title or email" className={`${inputClass} pl-10`} />
        </div>
        <div>
          <label htmlFor="emp-dept" className="sr-only">Department</label>
          <select id="emp-dept" value={dept} onChange={(e) => setDept(e.target.value)} className={inputClass}>
            {departments.map((d) => <option key={d} value={d}>{d === "ALL" ? "All departments" : d}</option>)}
          </select>
        </div>
      </div>

      {error && <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>}

      <div className="rounded-3xl bg-white border border-slate-200 overflow-x-auto">
        {!employees && !error ? (
          <p role="status" className="p-6 text-sm text-slate-600">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">{employees?.length ? "No one matches your search." : "No employees yet. Onboard your first team member."}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Employee directory</caption>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <tr>
                <th scope="col" className="py-3.5 px-4 font-semibold">Employee</th>
                <th scope="col" className="py-3.5 font-semibold">Department</th>
                <th scope="col" className="py-3.5 font-semibold">Wage / month</th>
                <th scope="col" className="py-3.5 font-semibold">Status</th>
                <th scope="col" className="py-3.5 pr-4 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="py-3.5 px-4">
                    <span className="flex items-center gap-3">
                      <AvatarBadge name={`${e.firstName} ${e.lastName}`} department={e.department} size="sm" />
                      <span>
                        <span className="font-bold text-slate-900 block">{e.firstName} {e.lastName}</span>
                        <span className="text-xs text-slate-600">{e.designation} · <span className="font-mono">{e.employeeId}</span></span>
                      </span>
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-800">{e.department}</td>
                  <td className="py-3.5 font-mono font-bold text-cyan-900">{formatCurrency(e.wage)}</td>
                  <td className="py-3.5"><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_STYLE[e.status]}`}>{e.status.replace("_", " ")}</span></td>
                  <td className="py-3.5 pr-4 text-right">
                    <span className="inline-flex gap-1.5">
                      <button onClick={() => setEditing(e)} aria-label={`Edit ${e.firstName} ${e.lastName}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-xs focus-visible:outline-2 focus-visible:outline-cyan-600"><Edit3 className="w-3.5 h-3.5" aria-hidden="true" /> Profile</button>
                      <button onClick={() => setSalaryFor(e)} aria-label={`Salary for ${e.firstName} ${e.lastName}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-900 font-bold text-xs border border-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-600"><IndianRupee className="w-3.5 h-3.5" aria-hidden="true" /> Salary</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {onboarding && (
        <OnboardDialog
          code={nextEmployeeCode(employees ?? [])}
          onClose={() => setOnboarding(false)}
          onCreated={(employee, pass) => {
            setOnboarding(false);
            setCredentials({ employee, pass });
            load();
          }}
        />
      )}

      {credentials && (
        <Dialog title="Share these sign-in details" description="The password is shown once. They will be asked to change it at first sign-in." onClose={() => setCredentials(null)}>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-mono space-y-2 mb-5 break-all">
            <p>Email: <strong>{credentials.employee.email}</strong></p>
            <p>Employee ID: <strong>{credentials.employee.employeeId}</strong></p>
            <p className="flex items-center gap-2"><KeyRound className="w-4 h-4 shrink-0 text-rose-700" aria-hidden="true" /> Password: <strong className="text-rose-800 select-all">{credentials.pass}</strong></p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={copyCredentials} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-sm focus-visible:outline-2 focus-visible:outline-cyan-600"><Copy className="w-4 h-4" aria-hidden="true" /> Copy</button>
            <button onClick={() => setCredentials(null)} className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">Done</button>
          </div>
        </Dialog>
      )}

      <EmployeeEditDrawer employee={editing} isOpen={Boolean(editing)} onClose={() => setEditing(null)} onSaved={load} />
      <SalaryStructureEditor employee={salaryFor} isOpen={Boolean(salaryFor)} onClose={() => setSalaryFor(null)} onSaved={load} />
    </div>
  );
}

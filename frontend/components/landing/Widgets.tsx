"use client";

import { useEffect, useState } from "react";
import { Check, LogIn, LogOut, X } from "lucide-react";
import { calculatePayablePayout, calculateSalaryStructure } from "@/lib/salary-calculator";
const formatCurrency = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const card = "rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_20px_50px_-28px_rgba(28,25,23,0.35)]";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";

/* ---------------------------------------------------------------- attendance */
export function CheckInDemo() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const secs = startedAt === null ? 0 : Math.max(0, Math.floor(((now || startedAt) - startedAt) / 1000));
  const clock = [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60].map((n) => String(n).padStart(2, "0")).join(":");
  const people = [
    ["Priya", "Engineering", true],
    ["Marcus", "Sales", true],
    ["Aiko", "Finance", false],
    ["You", "Today", startedAt !== null],
  ] as const;

  return (
    <div className={card}>
      <p className="text-sm font-semibold text-stone-700">Try it: check in</p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <output aria-live="off" className="font-mono text-4xl font-semibold tabular-nums text-stone-900">{clock}</output>
        <button
          onClick={() => { setNow(Date.now()); setStartedAt((s) => (s === null ? Date.now() : null)); }}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white ${startedAt === null ? "bg-teal-700 hover:bg-teal-600" : "bg-stone-900 hover:bg-stone-800"} ${focus}`}
        >
          {startedAt === null ? <LogIn className="h-4 w-4" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
          {startedAt === null ? "Check in" : "Check out"}
        </button>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {people.map(([name, dept, inNow]) => (
          <li key={name} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2">
            <span className={`h-2 w-2 rounded-full ${inNow ? "bg-emerald-600" : "bg-stone-400"}`} aria-hidden="true" />
            <span className="font-semibold text-stone-900">{name}</span>
            <span className="text-stone-600">{dept}</span>
            <span className="sr-only">{inNow ? "checked in" : "not in yet"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------------- leave */
type Req = { id: number; who: string; days: number; kind: string; state: "pending" | "approved" | "declined" };
const START: Req[] = [
  { id: 1, who: "Priya", days: 2, kind: "Sick", state: "pending" },
  { id: 2, who: "Marcus", days: 5, kind: "Paid", state: "pending" },
  { id: 3, who: "Aiko", days: 1, kind: "Casual", state: "pending" },
];

export function LeaveDemo() {
  const [reqs, setReqs] = useState(START);
  const decide = (id: number, state: "approved" | "declined") => setReqs((r) => r.map((x) => (x.id === id && x.state === "pending" ? { ...x, state } : x)));
  const approved = reqs.filter((r) => r.state === "approved").reduce((s, r) => s + r.days, 0);

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">Try it: approve leave</p>
        <p className="text-sm text-stone-700" aria-live="polite">{approved} day{approved === 1 ? "" : "s"} approved</p>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {reqs.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-4 py-3">
            <span className="text-sm"><strong className="text-stone-900">{r.who}</strong> <span className="text-stone-700">· {r.days} day{r.days > 1 ? "s" : ""} {r.kind.toLowerCase()}</span></span>
            {r.state === "pending" ? (
              <span className="flex gap-1.5">
                <button onClick={() => decide(r.id, "declined")} aria-label={`Decline ${r.who}'s request`} className={`grid h-9 w-9 place-items-center rounded-full border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 ${focus}`}><X className="h-4 w-4" aria-hidden="true" /></button>
                <button onClick={() => decide(r.id, "approved")} aria-label={`Approve ${r.who}'s request`} className={`grid h-9 w-9 place-items-center rounded-full bg-teal-700 text-white hover:bg-teal-600 ${focus}`}><Check className="h-4 w-4" aria-hidden="true" /></button>
              </span>
            ) : (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.state === "approved" ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-stone-800"}`}>{r.state === "approved" ? "Approved" : "Declined"}</span>
            )}
          </li>
        ))}
      </ul>
      <button onClick={() => setReqs(START)} className={`mt-3 text-xs font-semibold text-teal-800 underline underline-offset-2 ${focus}`}>Reset demo</button>
    </div>
  );
}

/* ------------------------------------------------------------------- payroll */
export function PayslipDemo() {
  const [wage, setWage] = useState(60000);
  const [days, setDays] = useState(22);
  const s = calculateSalaryStructure(wage);
  const p = calculatePayablePayout(s.netSalary, 22, days, 0);
  const parts: [string, number, string][] = [
    ["Basic", s.basic, "bg-teal-700"],
    ["HRA", s.hra, "bg-teal-500"],
    ["Allowances", s.standardAllowance + s.performanceBonus + s.lta + s.fixedAllowance, "bg-amber-400"],
  ];

  return (
    <div className={card}>
      <p className="text-sm font-semibold text-stone-700">Try it: build a payslip</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="demo-wage" className="flex justify-between text-sm font-semibold text-stone-900">Monthly gross <span className="font-mono">{formatCurrency(wage)}</span></label>
          <input id="demo-wage" type="range" min={15000} max={300000} step={1000} value={wage} onChange={(e) => setWage(Number(e.target.value))} className="mt-1 w-full accent-teal-700" />
        </div>
        <div>
          <label htmlFor="demo-days" className="flex justify-between text-sm font-semibold text-stone-900">Days worked <span className="font-mono">{days} / 22</span></label>
          <input id="demo-days" type="range" min={8} max={22} step={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 w-full accent-teal-700" />
        </div>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`Wage split: ${parts.map(([n, v]) => `${n} ${Math.round((v / s.wage) * 100)} percent`).join(", ")}`}>
        {parts.map(([n, v, c]) => <span key={n} className={c} style={{ width: `${(v / s.wage) * 100}%` }} />)}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-stone-600">PF + tax</dt><dd className="font-mono font-semibold text-rose-800">−{formatCurrency(s.totalDeductions)}</dd></div>
        <div><dt className="text-stone-600">Payable days</dt><dd className="font-mono font-semibold">{p.payableDays}</dd></div>
        <div aria-live="polite"><dt className="text-stone-600">Net pay</dt><dd className="font-mono text-lg font-bold text-teal-900">{formatCurrency(p.payableAmount)}</dd></div>
      </dl>
    </div>
  );
}

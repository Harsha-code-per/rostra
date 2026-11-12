"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { RostraApi } from "@/lib/api";
import type { LeaveBalance, LeaveRequest } from "@/lib/types";
import { ApplyLeaveModal } from "@/components/leaves/ApplyLeaveModal";
import { formatDate } from "@/lib/utils";

const TYPES = [
  { key: "PAID", label: "Paid leave", bar: "bg-cyan-700" },
  { key: "SICK", label: "Sick leave", bar: "bg-emerald-700" },
  { key: "CASUAL", label: "Casual leave", bar: "bg-amber-600" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-300",
  PENDING: "bg-amber-50 text-amber-900 border-amber-300",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-300",
};

export default function EmployeeLeavesPage() {
  const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([RostraApi.getLeaveBalances(), RostraApi.getLeaveRequests()]);
      setBalances(b);
      setRequests(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load leave data");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">Leave</h1>
          <p className="text-sm text-slate-600">Your balances and requests.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
          <Plus className="w-4 h-4" aria-hidden="true" /> Apply for time off
        </button>
      </div>

      {error && <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TYPES.map(({ key, label, bar }) => {
          const b = balances[key];
          const pct = b && b.allocated > 0 ? Math.min(100, (b.remaining / b.allocated) * 100) : 0;
          return (
            <div key={key} className="p-5 rounded-2xl bg-white border border-slate-200">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</p>
              <p className="my-1 text-3xl font-extrabold font-mono text-slate-900">
                {b ? b.remaining : "—"}<span className="text-sm font-normal text-slate-600"> / {b ? b.allocated : "—"} days</span>
              </p>
              <div role="progressbar" aria-label={`${label} remaining`} aria-valuemin={0} aria-valuemax={b?.allocated ?? 0} aria-valuenow={b?.remaining ?? 0} className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`${bar} h-full rounded-full`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-600">{b ? `${b.used} used` : ""}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-x-auto">
        <h2 className="text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">Requests</h2>
        {requests === null && !error ? (
          <p role="status" className="text-sm text-slate-600">Loading…</p>
        ) : requests && requests.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600">No leave requests yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Your leave requests</caption>
            <thead>
              <tr className="border-b border-slate-100 text-slate-600">
                <th scope="col" className="pb-3 font-semibold">Type</th>
                <th scope="col" className="pb-3 font-semibold">From</th>
                <th scope="col" className="pb-3 font-semibold">To</th>
                <th scope="col" className="pb-3 font-semibold">Days</th>
                <th scope="col" className="pb-3 font-semibold">Reason</th>
                <th scope="col" className="pb-3 font-semibold">HR note</th>
                <th scope="col" className="pb-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests?.map((r) => (
                <tr key={r.id}>
                  <td className="py-3.5 font-bold text-slate-800">{r.leaveType}</td>
                  <td className="py-3.5 font-mono text-slate-700">{formatDate(r.startDate)}</td>
                  <td className="py-3.5 font-mono text-slate-700">{formatDate(r.endDate)}</td>
                  <td className="py-3.5 font-mono font-bold text-cyan-800">{r.totalDays}</td>
                  <td className="py-3.5 text-slate-700 max-w-xs truncate">{r.reason}</td>
                  <td className="py-3.5 text-slate-600">{r.hrComments || "—"}</td>
                  <td className="py-3.5 text-right">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ApplyLeaveModal isOpen={open} onClose={() => setOpen(false)} onApplied={refresh} />
    </div>
  );
}

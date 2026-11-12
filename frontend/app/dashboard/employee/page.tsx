"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, FileText, Palmtree, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { RostraApi, type AttendanceOverview, type PayrollView } from "@/lib/api";
import type { LeaveBalance } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AvatarBadge } from "@/components/shared/AvatarBadge";
import { CheckInCard } from "@/components/attendance/CheckInCard";
import { ApplyLeaveModal } from "@/components/leaves/ApplyLeaveModal";
import { PayslipModal } from "@/components/payroll/PayslipModal";

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const emp = user!.employee;

  const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
  const [payroll, setPayroll] = useState<PayrollView | null>(null);
  const [attendance, setAttendance] = useState<AttendanceOverview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [payslipOpen, setPayslipOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [b, p, a] = await Promise.all([
        RostraApi.getLeaveBalances(),
        RostraApi.getEmployeePayroll(emp.id),
        RostraApi.getAttendance(),
      ]);
      setBalances(b);
      setPayroll(p);
      setAttendance(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load your dashboard");
    } finally {
      setLoaded(true);
    }
  }, [emp.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    refresh();
  }, [refresh]);

  const paid = balances.PAID;
  const s = attendance?.summary;
  const presence = s && s.totalWorkingDays > 0 ? Math.round(((s.presentDays + s.halfDays * 0.5) / s.totalWorkingDays) * 1000) / 10 : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <AvatarBadge name={`${emp.firstName} ${emp.lastName}`} department={emp.department} size="xl" status={emp.status} showStatus />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">Hello, {emp.firstName}</h1>
            <p className="text-sm text-slate-600">
              {[emp.designation, emp.department, emp.employeeId].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => setApplyOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-sm font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
            <Palmtree className="w-4 h-4 text-cyan-700" aria-hidden="true" /> Apply for leave
          </button>
          <button onClick={() => setPayslipOpen(true)} disabled={!payroll} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
            <FileText className="w-4 h-4" aria-hidden="true" /> Payslip PDF
          </button>
        </div>
      </div>

      {attendance && <CheckInCard today={attendance.today} onChange={refresh} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
            <span>Paid leave left</span><Palmtree className="w-4 h-4 text-cyan-700" aria-hidden="true" />
          </div>
          <p className="my-2 text-3xl font-extrabold font-mono text-cyan-800">{paid ? paid.remaining : loaded ? "—" : "…"}<span className="text-sm font-normal text-slate-600"> days</span></p>
          <p className="text-xs text-slate-600">{paid ? `${paid.allocated} allocated · ${paid.used} used` : "No allowance set"}</p>
          <Link href="/dashboard/employee/leaves" className="text-xs text-cyan-800 hover:underline font-bold">All balances →</Link>
        </div>

        <div className="p-5 rounded-2xl bg-cyan-50/60 border border-cyan-200">
          <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
            <span>Pay this month</span><Wallet className="w-4 h-4 text-cyan-700" aria-hidden="true" />
          </div>
          <p className="my-2 text-3xl font-extrabold font-mono text-slate-900">{payroll ? formatCurrency(payroll.payableSummary.payableAmount) : loaded ? "—" : "…"}</p>
          <p className="text-xs text-slate-600">{payroll ? `Based on ${payroll.payableSummary.payableDays} payable of ${payroll.payableSummary.totalWorkingDays} working days so far` : ""}</p>
          <Link href="/dashboard/employee/payroll" className="text-xs text-cyan-800 hover:underline font-bold">Statement & PDF →</Link>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
            <span>Presence this month</span><TrendingUp className="w-4 h-4 text-cyan-700" aria-hidden="true" />
          </div>
          <p className="my-2 text-3xl font-extrabold font-mono text-emerald-700">{presence !== null ? `${presence}%` : loaded ? "—" : "…"}</p>
          <p className="text-xs text-slate-600">{s ? `${s.presentDays} present, ${s.halfDays} half-day, ${s.leavesTaken} on leave` : ""}</p>
        </div>
      </div>

      <section aria-labelledby="recent-title" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 id="recent-title" className="text-sm font-bold text-slate-900 flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-700" aria-hidden="true" /> Recent attendance</h2>
          </div>
          <Link href="/dashboard/employee/attendance" className="text-xs text-cyan-800 hover:underline inline-flex items-center gap-1 font-bold">Full logbook <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></Link>
        </div>
        {attendance && attendance.records.length === 0 ? (
          <p className="text-sm text-slate-600 py-6 text-center">No attendance recorded yet. Check in above to start.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Your most recent attendance records</caption>
              <thead>
                <tr className="border-b border-slate-100 text-slate-600">
                  <th scope="col" className="pb-2.5 font-semibold">Date</th>
                  <th scope="col" className="pb-2.5 font-semibold">In</th>
                  <th scope="col" className="pb-2.5 font-semibold">Out</th>
                  <th scope="col" className="pb-2.5 font-semibold">Hours</th>
                  <th scope="col" className="pb-2.5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(attendance?.records ?? []).slice(0, 5).map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 font-semibold text-slate-800">{formatDate(r.workDate)}</td>
                    <td className="py-3 font-mono text-slate-700">{time(r.checkIn)}</td>
                    <td className="py-3 font-mono text-slate-700">{r.checkOut ? time(r.checkOut) : r.checkIn ? "Active" : "—"}</td>
                    <td className="py-3 font-mono font-bold text-cyan-800">{r.totalHours > 0 ? `${r.totalHours.toFixed(2)}h` : "—"}</td>
                    <td className="py-3 text-right text-xs font-bold text-slate-700">{r.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ApplyLeaveModal isOpen={applyOpen} onClose={() => setApplyOpen(false)} onApplied={refresh} />
      {payroll && (
        <PayslipModal employee={emp} structure={payroll.structure} payableSummary={payroll.payableSummary} month={payroll.month} year={payroll.year} isOpen={payslipOpen} onClose={() => setPayslipOpen(false)} />
      )}
    </div>
  );
}

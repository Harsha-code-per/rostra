"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { CheckCircle2, Clock, Palmtree, Users, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { RostraApi, type AnalyticsSummary } from "@/lib/api";
import type { LeaveRequest } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AvatarBadge } from "@/components/shared/AvatarBadge";
import { LeaveApprovalDrawer } from "@/components/leaves/LeaveApprovalDrawer";
import { LeaveKanbanBoard } from "@/components/dashboard/LeaveKanbanBoard";

const AttendanceTrendChart = dynamic(() => import("@/components/dashboard/AnalyticsCharts").then((m) => m.AttendanceTrendChart), { ssr: false });

type Tab = "OVERVIEW" | "KANBAN";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [active, setActive] = useState<LeaveRequest | null>(null);
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, l] = await Promise.all([RostraApi.getAnalyticsSummary(), RostraApi.getLeaveRequests()]);
      setAnalytics(a);
      setLeaves(l);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the dashboard");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  const review = async (id: string, status: "APPROVED" | "REJECTED"): Promise<boolean> => {
    try {
      await RostraApi.reviewLeave(id, status);
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the request");
      return false;
    }
  };

  const m = analytics?.metrics;
  const pending = leaves.filter((r) => r.status === "PENDING");
  const card = "p-5 rounded-2xl bg-white border border-slate-200 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">Welcome, {user?.employee.firstName}</h1>
          <p className="text-sm text-slate-600">{user?.companyName ?? "Your workspace"} · workforce overview</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/admin/attendance" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"><Clock className="w-4 h-4 text-cyan-700" aria-hidden="true" /> Attendance</Link>
          <Link href="/dashboard/admin/payroll" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"><Wallet className="w-4 h-4" aria-hidden="true" /> Payroll</Link>
        </div>
      </div>

      {error && <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/admin/employees" className={card}>
          <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">Total staff <Users className="w-4 h-4 text-cyan-700" aria-hidden="true" /></span>
          <span className="block my-2 text-3xl font-extrabold font-mono">{m ? m.totalEmployees : "…"}</span>
          <span className="text-xs font-bold text-cyan-800">Open directory →</span>
        </Link>
        <div className={card}>
          <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">Present today <Clock className="w-4 h-4 text-cyan-700" aria-hidden="true" /></span>
          <span className="block my-2 text-3xl font-extrabold font-mono text-emerald-700">{m ? m.presentToday : "…"}<span className="text-sm font-normal text-slate-600"> / {m?.totalEmployees ?? "…"}</span></span>
          <span className="text-xs text-slate-600">{m ? `${m.attendanceRate}% attendance, ${m.onLeaveToday} on leave` : ""}</span>
        </div>
        <button type="button" onClick={() => setTab("KANBAN")} className={card}>
          <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">Pending leave <Palmtree className="w-4 h-4 text-amber-700" aria-hidden="true" /></span>
          <span className="block my-2 text-3xl font-extrabold font-mono text-amber-700">{m ? m.pendingLeaves : "…"}</span>
          <span className="text-xs font-bold text-amber-900">Review →</span>
        </button>
        <Link href="/dashboard/admin/payroll" className={card}>
          <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">Monthly payroll <Wallet className="w-4 h-4 text-cyan-700" aria-hidden="true" /></span>
          <span className="block my-2 text-3xl font-extrabold font-mono">{m ? formatCurrency(m.monthlyPayrollTotal) : "…"}</span>
          <span className="text-xs font-bold text-cyan-800">Payroll →</span>
        </Link>
      </div>

      <div role="tablist" aria-label="Dashboard view" className="flex gap-2 p-1.5 rounded-2xl bg-slate-100 max-w-fit">
        {([["OVERVIEW", "Overview"], ["KANBAN", `Leave board${pending.length ? ` (${pending.length})` : ""}`]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-xl text-sm font-bold focus-visible:outline-2 focus-visible:outline-cyan-600 ${tab === key ? "bg-white text-slate-900 shadow-xs" : "text-slate-700 hover:text-slate-900"}`}>{label}</button>
        ))}
      </div>

      {tab === "OVERVIEW" ? (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="trend" className="p-6 rounded-3xl bg-white border border-slate-200">
            <h2 id="trend" className="text-sm font-bold mb-4">Attendance, last 5 days</h2>
            {analytics ? <AttendanceTrendChart data={analytics.attendanceTrends} /> : <p className="text-sm text-slate-600">Loading…</p>}
          </section>

          <section aria-labelledby="queue" className="p-6 rounded-3xl bg-white border border-slate-200">
            <h2 id="queue" className="text-sm font-bold mb-4 pb-3 border-b border-slate-100">Leave awaiting review</h2>
            {pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-700 flex flex-col items-center gap-2"><CheckCircle2 className="w-8 h-8 text-emerald-600" aria-hidden="true" />Nothing waiting. You are all caught up.</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pending.map((r) => (
                  <li key={r.id} className="p-5 rounded-2xl bg-cyan-50/50 border border-cyan-200 flex flex-col gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      <AvatarBadge name={r.employeeName} department={r.department} size="md" />
                      <div>
                        <p className="font-bold text-slate-900">{r.employeeName}</p>
                        <p className="text-xs text-cyan-900 font-semibold">{r.department} · {r.totalDays} day(s) {r.leaveType.toLowerCase()}</p>
                      </div>
                    </div>
                    <p className="text-slate-800">{r.reason}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-cyan-200">
                      <span className="text-xs text-slate-700 font-mono">{formatDate(r.startDate)} → {formatDate(r.endDate)}</span>
                      <span className="flex gap-2">
                        <button onClick={() => review(r.id, "APPROVED").then((ok) => ok && toast.success("Approved"))} className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Approve</button>
                        <button onClick={() => setActive(r)} className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 font-bold text-xs focus-visible:outline-2 focus-visible:outline-cyan-600">Details</button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <LeaveKanbanBoard requests={leaves} onUpdateRequestStatus={review} onOpenReviewDrawer={setActive} />
      )}

      <LeaveApprovalDrawer request={active} onClose={() => setActive(null)} onReviewed={load} />
    </div>
  );
}

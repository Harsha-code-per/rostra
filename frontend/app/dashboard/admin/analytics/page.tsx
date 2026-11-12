"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import { RostraApi, type AnalyticsSummary } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

// recharts is heavy; load it only on the pages that draw charts.
const AttendanceTrendChart = dynamic(() => import("@/components/dashboard/AnalyticsCharts").then((m) => m.AttendanceTrendChart), { ssr: false });
const DepartmentChart = dynamic(() => import("@/components/dashboard/AnalyticsCharts").then((m) => m.DepartmentChart), { ssr: false });

function downloadCsv(a: AnalyticsSummary) {
  const rows = [
    ["Department", "Headcount", "Monthly payroll"],
    ...a.departmentDistribution.map((d) => [d.name, d.count, d.payroll]),
    [],
    ["Day", "Present", "On leave", "Absent"],
    ...a.attendanceTrends.map((t) => [t.date, t.present, t.leave, t.absent]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `rostra-report-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminAnalyticsPage() {
  const [a, setA] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    RostraApi.getAnalyticsSummary().then(setA).catch((e) => setError(e instanceof Error ? e.message : "Could not load analytics"));
  }, []);

  if (error) return <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>;
  if (!a) return <p role="status" className="text-sm text-slate-600">Loading analytics…</p>;

  const m = a.metrics;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-600">Headcount, attendance and payroll, straight from your data.</p>
        </div>
        <button onClick={() => downloadCsv(a)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
          <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
        </button>
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Headcount", String(m.totalEmployees)],
          ["Present today", `${m.presentToday} (${m.attendanceRate}%)`],
          ["Pending leave", String(m.pendingLeaves)],
          ["Monthly payroll", formatCurrency(m.monthlyPayrollTotal)],
        ].map(([k, v]) => (
          <div key={k} className="p-5 rounded-2xl bg-white border border-slate-200">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-600">{k}</dt>
            <dd className="mt-1 text-2xl font-extrabold font-mono text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-labelledby="trend" className="p-6 rounded-3xl bg-white border border-slate-200">
          <h2 id="trend" className="text-sm font-bold mb-4">Last 5 days</h2>
          <AttendanceTrendChart data={a.attendanceTrends} />
        </section>
        <section aria-labelledby="dept" className="p-6 rounded-3xl bg-white border border-slate-200">
          <h2 id="dept" className="text-sm font-bold mb-4">Headcount by department</h2>
          {a.departmentDistribution.length ? <DepartmentChart data={a.departmentDistribution} /> : <p className="text-sm text-slate-600">No employees yet.</p>}
        </section>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { RostraApi, type AttendanceOverview } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PRESENT", label: "Present" },
  { key: "HALF_DAY", label: "Half day" },
  { key: "ON_LEAVE", label: "On leave" },
];

export default function EmployeeAttendancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<AttendanceOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    RostraApi.getAttendance().then(setData).catch((e) => setError(e instanceof Error ? e.message : "Could not load attendance"));
  }, [user?.id]);

  const logs = (data?.records ?? []).filter((l) => filter === "ALL" || l.status === filter);
  const s = data?.summary;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">Attendance log</h1>
          <p className="text-sm text-slate-600">Your check-ins, hours and leave days.</p>
        </div>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white border border-slate-200 text-sm">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={`px-3 py-1.5 rounded-xl font-bold focus-visible:outline-2 focus-visible:outline-cyan-600 ${filter === f.key ? "bg-cyan-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>}

      {s && (
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["Hours this month", `${s.totalHoursWorked.toFixed(1)} h`],
            ["Days present", String(s.presentDays)],
            ["Half days", String(s.halfDays)],
            ["Days on leave", String(s.leavesTaken)],
          ].map(([label, value]) => (
            <div key={label} className="p-5 rounded-2xl bg-white border border-slate-200">
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</dt>
              <dd className="text-3xl font-extrabold font-mono text-slate-900 mt-1">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-x-auto">
        {!data && !error ? (
          <p role="status" className="text-sm text-slate-600">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-600 py-6 text-center">No records to show.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Attendance records</caption>
            <thead>
              <tr className="border-b border-slate-100 text-slate-600">
                <th scope="col" className="pb-3 font-semibold">Date</th>
                <th scope="col" className="pb-3 font-semibold">In</th>
                <th scope="col" className="pb-3 font-semibold">Out</th>
                <th scope="col" className="pb-3 font-semibold">Hours</th>
                <th scope="col" className="pb-3 font-semibold">Notes</th>
                <th scope="col" className="pb-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((r) => (
                <tr key={r.id}>
                  <td className="py-3.5 font-bold text-slate-800">{formatDate(r.workDate)}</td>
                  <td className="py-3.5 font-mono text-slate-700">{formatTime(r.checkIn)}</td>
                  <td className="py-3.5 font-mono text-slate-700">{r.checkOut ? formatTime(r.checkOut) : r.checkIn ? "Active" : "--:--"}</td>
                  <td className="py-3.5 font-mono font-bold text-cyan-800">{r.totalHours.toFixed(2)}</td>
                  <td className="py-3.5 text-slate-600">{r.notes || "—"}</td>
                  <td className="py-3.5 text-right text-xs font-bold text-slate-700">{r.status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

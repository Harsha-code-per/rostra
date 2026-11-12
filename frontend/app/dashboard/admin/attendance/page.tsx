"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit2 } from "lucide-react";
import { RostraApi } from "@/lib/api";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/utils";
import { AvatarBadge } from "@/components/shared/AvatarBadge";
import { Dialog } from "@/components/shared/Dialog";
import { inputClass } from "@/components/shared/AuthShell";

const STATUSES: AttendanceStatus[] = ["PRESENT", "HALF_DAY", "ON_LEAVE", "ABSENT"];
const label = (s: string) => s.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const today = () => new Date().toISOString().split("T")[0];

function OverrideDialog({ row, date, onClose, onSaved }: { row: AttendanceRecord; date: string; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<AttendanceStatus>(row.status);
  const [hours, setHours] = useState(String(row.totalHours));
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await RostraApi.overrideAttendance({ employeeId: row.employeeId, workDate: date, status, totalHours: Number(hours) });
      toast.success(`Attendance updated for ${row.employeeName}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update attendance");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Adjust attendance" description={`${row.employeeName} · ${formatDate(date)}`} onClose={onClose} className="max-w-sm">
      <form onSubmit={save} className="flex flex-col gap-4">
        <div>
          <label htmlFor="ov-status" className="block text-sm font-semibold text-slate-800 mb-1.5">Status</label>
          <select id="ov-status" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)} className={inputClass}>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ov-hours" className="block text-sm font-semibold text-slate-800 mb-1.5">Hours worked</label>
          <input id="ov-hours" type="number" min={0} max={24} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm focus-visible:outline-2 focus-visible:outline-cyan-600">Cancel</button>
          <button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Dialog>
  );
}

export default function AdminAttendancePage() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);

  const load = useCallback(() => {
    RostraApi.getCompanyAttendance(date)
      .then((r) => (setRows(r), setError(null)))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load attendance"));
  }, [date]);

  useEffect(() => {
     
    load();
  }, [load]);

  const all = rows ?? [];
  const count = (s: AttendanceStatus) => all.filter((r) => r.status === s).length;
  const shown = filter === "ALL" ? all : all.filter((r) => r.status === filter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-600">Who is in, who is out, and manual corrections.</p>
        </div>
        <div>
          <label htmlFor="att-date" className="block text-sm font-semibold text-slate-800 mb-1.5">Date</label>
          <input id="att-date" type="date" max={today()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      {error && <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[["Total staff", all.length], ["Present", count("PRESENT")], ["On leave", count("ON_LEAVE")], ["Half day", count("HALF_DAY")]].map(([k, v]) => (
          <div key={k} className="p-5 rounded-2xl bg-white border border-slate-200">
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-600">{k}</dt>
            <dd className="mt-1 text-3xl font-extrabold font-mono">{rows ? v : "…"}</dd>
          </div>
        ))}
      </dl>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-sm font-bold">Log for {formatDate(date)}</h2>
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {["ALL", ...STATUSES].map((s) => (
              <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} className={`px-3 py-1 rounded-xl text-xs font-bold focus-visible:outline-2 focus-visible:outline-cyan-600 ${filter === s ? "bg-cyan-800 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200"}`}>{s === "ALL" ? "All" : label(s)}</button>
            ))}
          </div>
        </div>
        {!rows && !error ? (
          <p role="status" className="text-sm text-slate-600">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-600">No employees match.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Attendance for {formatDate(date)}</caption>
            <thead>
              <tr className="border-b border-slate-100 text-slate-600">
                <th scope="col" className="pb-3 font-semibold">Employee</th>
                <th scope="col" className="pb-3 font-semibold">Department</th>
                <th scope="col" className="pb-3 font-semibold">In</th>
                <th scope="col" className="pb-3 font-semibold">Out</th>
                <th scope="col" className="pb-3 font-semibold">Hours</th>
                <th scope="col" className="pb-3 font-semibold">Status</th>
                <th scope="col" className="pb-3 font-semibold text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <tr key={r.employeeId}>
                  <td className="py-3.5">
                    <span className="flex items-center gap-2.5">
                      <AvatarBadge name={r.employeeName ?? ""} department={r.department} size="sm" />
                      <span><span className="font-bold text-slate-900 block">{r.employeeName}</span><span className="text-xs text-slate-600 font-mono">{r.employeeId}</span></span>
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-800">{r.department}</td>
                  <td className="py-3.5 font-mono text-slate-700">{formatTime(r.checkIn)}</td>
                  <td className="py-3.5 font-mono text-slate-700">{r.checkOut ? formatTime(r.checkOut) : r.checkIn ? "Active" : "--:--"}</td>
                  <td className="py-3.5 font-mono font-bold text-cyan-800">{r.totalHours.toFixed(1)}</td>
                  <td className="py-3.5 text-xs font-bold text-slate-800">{label(r.status)}</td>
                  <td className="py-3.5 text-right">
                    <button onClick={() => setEditing(r)} aria-label={`Adjust attendance for ${r.employeeName}`} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold inline-flex items-center gap-1.5 text-xs focus-visible:outline-2 focus-visible:outline-cyan-600">
                      <Edit2 className="w-3.5 h-3.5 text-cyan-700" aria-hidden="true" /> Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && <OverrideDialog row={editing} date={date} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

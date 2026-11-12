"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, LogIn, LogOut } from "lucide-react";
import { RostraApi, type AttendanceOverview } from "@/lib/api";

function elapsed(from: string, to?: string | null) {
  const ms = Math.max(0, (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function CheckInCard({ today, onChange }: { today: AttendanceOverview["today"]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const running = today.checkedIn && !today.checkedOut;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const act = async () => {
    setBusy(true);
    try {
      if (running) await RostraApi.checkOut();
      else await RostraApi.checkIn();
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update attendance");
    } finally {
      setBusy(false);
    }
  };

  const done = today.checkedIn && today.checkedOut;
  return (
    <section aria-labelledby="checkin-title" className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="grid place-items-center h-12 w-12 rounded-2xl bg-cyan-50 text-cyan-700" aria-hidden="true">
          <Clock className="w-6 h-6" />
        </span>
        <div>
          <h2 id="checkin-title" className="text-sm font-bold text-slate-900">Today</h2>
          <p className="text-3xl font-mono font-extrabold text-slate-900" aria-label="Time worked today">
            {today.checkInTime ? elapsed(today.checkInTime, today.checkOutTime) : "00:00:00"}
          </p>
          <p className="text-xs text-slate-600">
            {done ? "Shift complete" : running ? "You are checked in" : "You have not checked in yet"}
          </p>
        </div>
      </div>
      {!done && (
        <button
          onClick={act}
          disabled={busy}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${running ? "bg-slate-900 hover:bg-slate-800" : "bg-cyan-700 hover:bg-cyan-600"}`}
        >
          {running ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
          {busy ? "Please wait…" : running ? "Check out" : "Check in"}
        </button>
      )}
    </section>
  );
}

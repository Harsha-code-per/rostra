"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { RostraApi } from "@/lib/api";
import type { LeaveType } from "@/lib/types";
import { Dialog } from "@/components/shared/Dialog";
import { inputClass } from "@/components/shared/AuthShell";

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

export function ApplyLeaveModal({ isOpen, onClose, onApplied }: ApplyLeaveModalProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>("SICK");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1;
  const invalidRange = Number.isNaN(days) || days < 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await RostraApi.applyLeave({ leaveType, startDate, endDate, reason: reason.trim() });
      toast.success("Leave request sent to HR");
      onApplied?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Apply for time off" description="Your request goes to HR for approval." onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="leave-type" className="block text-sm font-semibold text-slate-800 mb-1.5">Leave type</label>
          <select id="leave-type" value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)} className={inputClass}>
            <option value="PAID">Paid leave</option>
            <option value="SICK">Sick leave</option>
            <option value="CASUAL">Casual leave</option>
            <option value="UNPAID">Unpaid leave</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="leave-start" className="block text-sm font-semibold text-slate-800 mb-1.5">From</label>
            <input id="leave-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="leave-end" className="block text-sm font-semibold text-slate-800 mb-1.5">To</label>
            <input id="leave-end" type="date" required min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <p role="status" className={`text-sm font-semibold ${invalidRange ? "text-red-700" : "text-cyan-800"}`}>
          {invalidRange ? "The end date must be on or after the start date." : `${days} day${days > 1 ? "s" : ""} requested`}
        </p>
        <div>
          <label htmlFor="leave-reason" className="block text-sm font-semibold text-slate-800 mb-1.5">Reason</label>
          <textarea id="leave-reason" required minLength={3} maxLength={2000} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </div>
        <button type="submit" disabled={busy || invalidRange} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
          <Send className="w-4 h-4" aria-hidden="true" /> {busy ? "Sending…" : "Send request"}
        </button>
      </form>
    </Dialog>
  );
}

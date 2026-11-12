"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import type { LeaveRequest } from "@/lib/types";
import { RostraApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { AvatarBadge } from "@/components/shared/AvatarBadge";
import { Dialog } from "@/components/shared/Dialog";
import { inputClass } from "@/components/shared/AuthShell";

interface Props {
  request: LeaveRequest | null;
  onClose: () => void;
  onReviewed: () => void;
}

export function LeaveApprovalDrawer({ request, onClose, onReviewed }: Props) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!request) return null;
  const pending = request.status === "PENDING";

  const decide = async (status: "APPROVED" | "REJECTED") => {
    setBusy(true);
    try {
      await RostraApi.reviewLeave(request.id, status, notes.trim());
      toast.success(`Request ${status === "APPROVED" ? "approved" : "rejected"}`);
      onReviewed();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process the request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Leave request" onClose={onClose} className="max-w-lg">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
        <AvatarBadge name={request.employeeName} department={request.department} size="md" />
        <div>
          <p className="font-bold text-slate-900">{request.employeeName}</p>
          <p className="text-sm text-slate-600">{request.department} · {request.totalDays} day(s) {request.leaveType.toLowerCase()}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200"><dt className="text-xs text-slate-600">From</dt><dd className="font-bold">{formatDate(request.startDate)}</dd></div>
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200"><dt className="text-xs text-slate-600">To</dt><dd className="font-bold">{formatDate(request.endDate)}</dd></div>
      </dl>
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-4 text-sm">
        <p className="text-xs text-slate-600 mb-1">Reason</p>
        <p className="text-slate-800">{request.reason}</p>
      </div>
      {pending ? (
        <>
          <label htmlFor="review-notes" className="block text-sm font-semibold text-slate-800 mb-1.5">Note to the employee (optional)</label>
          <textarea id="review-notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} mb-5`} />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => decide("REJECTED")} className="py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-sm border border-rose-300 inline-flex items-center justify-center gap-1.5 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600">
              <XCircle className="w-4 h-4" aria-hidden="true" /> Reject
            </button>
            <button type="button" disabled={busy} onClick={() => decide("APPROVED")} className="py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Approve
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm font-semibold text-slate-700">This request was {request.status.toLowerCase()}{request.hrComments ? `: ${request.hrComments}` : "."}</p>
      )}
    </Dialog>
  );
}

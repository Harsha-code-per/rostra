"use client";

import React, { useState } from "react";
import { LeaveRequest } from "@/lib/types";
import { AvatarBadge } from "@/components/shared/AvatarBadge";
import { formatDate } from "@/lib/utils";
import {
  Filter,
  Search,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

interface LeaveKanbanBoardProps {
  requests: LeaveRequest[];
  onUpdateRequestStatus: (requestId: string, newStatus: "APPROVED" | "REJECTED") => Promise<boolean>;
  onOpenReviewDrawer: (request: LeaveRequest) => void;
}

export function LeaveKanbanBoard({
  requests,
  onUpdateRequestStatus,
  onOpenReviewDrawer,
}: LeaveKanbanBoardProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredRequests = requests.filter((r) => {
    const matchesType = filterType === "ALL" || r.leaveType === filterType;
    const matchesQuery =
      r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reason.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesQuery;
  });

  const pendingList = filteredRequests.filter((r) => r.status === "PENDING");
  const approvedList = filteredRequests.filter((r) => r.status === "APPROVED");
  const rejectedList = filteredRequests.filter((r) => r.status === "REJECTED");

  const handleQuickApprove = async (req: LeaveRequest) => {
    if (!(await onUpdateRequestStatus(req.id, "APPROVED"))) return;
    toast.success(`Leave request approved for ${req.employeeName}`, {
      description: `${req.totalDays} day(s) of ${req.leaveType} leave confirmed.`,
    });
  };

  const handleQuickReject = async (req: LeaveRequest) => {
    if (!(await onUpdateRequestStatus(req.id, "REJECTED"))) return;
    toast.info(`Leave request rejected for ${req.employeeName}`);
  };

  const renderCard = (req: LeaveRequest) => {
    return (
      <div
        key={req.id}
        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-cyan-300 transition-all text-xs flex flex-col justify-between gap-3 group animate-in fade-in"
      >
        {/* Top Card Info */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[11px] uppercase tracking-wider ${
                req.leaveType === "PAID"
                  ? "bg-cyan-50 text-cyan-800 border border-cyan-200"
                  : req.leaveType === "SICK"
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}
            >
              {req.leaveType} · {req.totalDays} Day(s)
            </span>

            <span className="text-[11px] font-mono text-slate-600">
              {formatDate(req.startDate)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 my-2">
            <AvatarBadge name={req.employeeName} department={req.department} size="sm" />
            <div>
              <h4 className="font-bold text-slate-900 text-xs leading-tight">
                {req.employeeName}
              </h4>
              <span className="text-[11px] text-slate-600">{req.department}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2">
            &quot;{req.reason}&quot;
          </p>
        </div>

        {/* Action Controls based on Column */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => onOpenReviewDrawer(req)}
            className="text-[11px] text-cyan-800 hover:text-cyan-900 font-semibold flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Details</span>
          </button>

          <div className="flex items-center gap-1">
            {req.status === "PENDING" && (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickReject(req)}
                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition-colors border border-rose-200"
                  title="Reject Leave"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickApprove(req)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white font-bold text-[11px] transition-colors shadow-2xs"
                  title="Approve Leave"
                >
                  Approve
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Kanban Filters & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee, dept, or reason..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-cyan-600" /> Type:
          </span>
          {["ALL", "PAID", "SICK", "UNPAID"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                filterType === t
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Interactive Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {/* Column 1: Pending Review */}
        <div className="rounded-3xl bg-amber-50/40 border border-amber-200/80 p-4 flex flex-col gap-3 min-h-[350px]">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="font-bold font-heading text-slate-900 text-xs">Pending Review</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono font-bold text-[11px] border border-amber-300">
              {pendingList.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {pendingList.length === 0 ? (
              <div className="p-8 text-center text-[11px] text-slate-600 bg-white/60 rounded-2xl border border-dashed border-amber-200">
                No pending requests. Queue is clear!
              </div>
            ) : (
              pendingList.map(renderCard)
            )}
          </div>
        </div>

        {/* Column 2: Approved */}
        <div className="rounded-3xl bg-emerald-50/40 border border-emerald-200/80 p-4 flex flex-col gap-3 min-h-[350px]">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-bold font-heading text-slate-900 text-xs">Approved & Active</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono font-bold text-[11px] border border-emerald-300">
              {approvedList.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {approvedList.length === 0 ? (
              <div className="p-8 text-center text-[11px] text-slate-600 bg-white/60 rounded-2xl border border-dashed border-emerald-200">
                No approved leave records.
              </div>
            ) : (
              approvedList.map(renderCard)
            )}
          </div>
        </div>

        {/* Column 3: Rejected */}
        <div className="rounded-3xl bg-rose-50/40 border border-rose-200/80 p-4 flex flex-col gap-3 min-h-[350px]">
          <div className="flex items-center justify-between pb-2 border-b border-rose-200/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <h3 className="font-bold font-heading text-slate-900 text-xs">Rejected / Declined</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 font-mono font-bold text-[11px] border border-rose-300">
              {rejectedList.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {rejectedList.length === 0 ? (
              <div className="p-8 text-center text-[11px] text-slate-600 bg-white/60 rounded-2xl border border-dashed border-rose-200">
                No rejected applications.
              </div>
            ) : (
              rejectedList.map(renderCard)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

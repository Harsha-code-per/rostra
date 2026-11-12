"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { RostraApi } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
};

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.isRead).length;

  useEffect(() => {
    RostraApi.getNotifications().then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAll = useCallback(async () => {
    await Promise.all(items.filter((n) => !n.isRead).map((n) => RostraApi.markNotificationRead(n.id)));
    setItems((p) => p.map((n) => ({ ...n, isRead: true })));
  }, [items]);

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff6b3d] px-1 text-[11px] font-bold text-stone-900">{unread}</span>}
      </button>

      {open && (
        <div role="region" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-[min(92vw,24rem)] rounded-2xl border border-stone-200 bg-white p-2 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-semibold text-stone-900">Notifications</p>
            {unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-teal-800 hover:underline focus-visible:outline-2 focus-visible:outline-teal-700">Mark all read</button>}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-stone-600">You are all caught up.</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className={`rounded-xl px-3 py-2.5 ${n.isRead ? "" : "bg-teal-50/70"}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-stone-900">{n.title}</p>
                    <time dateTime={n.createdAt} className="shrink-0 text-xs text-stone-600">{ago(n.createdAt)}</time>
                  </div>
                  <p className="mt-0.5 text-sm leading-snug text-stone-700">{n.message}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

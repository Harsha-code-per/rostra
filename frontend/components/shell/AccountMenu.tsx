"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, LogOut, UserCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AvatarBadge } from "@/components/shared/AvatarBadge";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Company admin", HR: "HR", EMPLOYEE: "Employee", SUPER_ADMIN: "Platform owner" };

export function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

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

  if (!user) return null;
  const name = `${user.employee.firstName} ${user.employee.lastName}`.trim() || user.email;

  return (
    <div ref={wrap} className="relative">
      {open && (
        <div role="menu" aria-label="Account" className={`absolute bottom-full z-50 mb-2 w-64 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] ${collapsed ? "left-0" : "inset-x-0 w-auto"}`}>
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-stone-900">{name}</p>
            <p className="truncate text-xs text-stone-600">{user.email}</p>
            {user.companyName && <p className="mt-1 truncate text-xs text-stone-600">{user.companyName}</p>}
          </div>
          <Link role="menuitem" href="/dashboard/employee/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-teal-700">
            <UserCircle2 className="h-4 w-4 text-stone-600" aria-hidden="true" /> My profile
          </Link>
          <button role="menuitem" onClick={() => { setOpen(false); logout(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-700">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={collapsed ? `Account: ${name}` : undefined}
        className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${collapsed ? "justify-center" : ""}`}
      >
        <AvatarBadge name={name} department={user.employee.department} size="sm" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight text-stone-900">{name}</span>
              <span className="block truncate text-xs text-stone-600">{ROLE_LABEL[user.role] ?? user.role}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-stone-500" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

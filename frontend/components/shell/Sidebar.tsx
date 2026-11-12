"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarCheck, Clock, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Palmtree, UserCircle2, Users, Wallet, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AccountMenu } from "./AccountMenu";

interface Item { label: string; href: string; icon: LucideIcon }
const EMPLOYEE: Item[] = [
  { label: "My day", href: "/dashboard/employee", icon: Clock },
  { label: "Attendance", href: "/dashboard/employee/attendance", icon: CalendarCheck },
  { label: "Leave", href: "/dashboard/employee/leaves", icon: Palmtree },
  { label: "Pay", href: "/dashboard/employee/payroll", icon: Wallet },
  { label: "Profile", href: "/dashboard/employee/profile", icon: UserCircle2 },
];
const STAFF: Item[] = [
  { label: "Overview", href: "/dashboard/admin", icon: LayoutDashboard },
  { label: "Employees", href: "/dashboard/admin/employees", icon: Users },
  { label: "Attendance", href: "/dashboard/admin/attendance", icon: CalendarCheck },
  { label: "Leave", href: "/dashboard/admin/leaves", icon: Palmtree },
  { label: "Payroll", href: "/dashboard/admin/payroll", icon: Wallet },
  { label: "Analytics", href: "/dashboard/admin/analytics", icon: BarChart3 },
];

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = user?.role === "ADMIN" || user?.role === "HR" ? STAFF : EMPLOYEE;
  // On phones the sidebar is a drawer and is always shown expanded.
  const rail = collapsed && !mobileOpen;
  // One fixed-position tooltip for the rail. Per-item absolute tooltips would overflow the nav and add a scrollbar.
  const [tip, setTip] = useState<{ label: string; y: number } | null>(null);
  const showTip = (label: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, y: r.top + r.height / 2 });
  };
  const hideTip = () => setTip(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseMobile();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onCloseMobile]);

  const isActive = (href: string) => (items.some((i) => i.href !== href && i.href.startsWith(`${href}/`)) ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      {mobileOpen && <div onClick={onCloseMobile} aria-hidden="true" className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-[2px] lg:hidden" />}

      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-stone-200 bg-white transition-[width,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:static lg:z-auto ${rail ? "lg:w-[76px]" : "lg:w-[260px]"} w-[272px] ${mobileOpen ? "max-lg:translate-x-0 shadow-2xl" : "max-lg:-translate-x-full"}`}
      >
        {/* Product. The logo doubles as the expand control when the sidebar is a rail. */}
        <div className={`flex h-[72px] shrink-0 items-center ${rail ? "justify-center" : "justify-between pl-5 pr-3"}`}>
          {rail ? (
            <button onClick={onToggleCollapse} aria-label="Expand sidebar" title="Expand sidebar (Ctrl+B)" className="group relative grid h-11 w-11 place-items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" className="h-9 w-9 transition-all duration-200 group-hover:scale-90 group-hover:opacity-0 group-focus-visible:scale-90 group-focus-visible:opacity-0" />
              <span className="absolute inset-0 grid scale-90 place-items-center rounded-xl bg-teal-50 text-teal-900 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
                <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
              </span>
            </button>
          ) : (
            <>
              <Link href="/" aria-label="Rostra home" className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.svg" alt="" className="h-9 w-9" />
                <span className="font-heading text-xl font-bold tracking-tight text-stone-900">Rostra</span>
              </Link>
              <button onClick={mobileOpen ? onCloseMobile : onToggleCollapse} aria-label={mobileOpen ? "Close menu" : "Collapse sidebar"} title={mobileOpen ? "Close menu" : "Collapse sidebar (Ctrl+B)"} className="grid h-10 w-10 place-items-center rounded-xl text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-2">
          {!rail && <p className="px-3 pb-2 text-xs font-semibold text-stone-600">{user?.role === "EMPLOYEE" ? "Your workspace" : "Workspace"}</p>}
          <ul className="flex flex-col gap-1">
            {items.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onCloseMobile}
                    aria-current={active ? "page" : undefined}
                    aria-label={rail ? label : undefined}
                    onMouseEnter={rail ? showTip(label) : undefined}
                    onFocus={rail ? showTip(label) : undefined}
                    onMouseLeave={hideTip}
                    onBlur={hideTip}
                    className={`relative flex h-11 items-center gap-3 rounded-xl text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${rail ? "justify-center" : "px-3"} ${active ? "bg-teal-50 font-semibold text-teal-950" : "font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-950"}`}
                  >
                    {active && !rail && <span aria-hidden="true" className="absolute left-0 top-2.5 h-6 w-[3px] rounded-r-full bg-[#ff6b3d]" />}
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-teal-800" : "text-stone-500"}`} aria-hidden="true" />
                    {!rail && <span className="truncate">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-stone-100 p-3">
          <AccountMenu collapsed={rail} />
        </div>
      </aside>

      {rail && tip && (
        <span role="presentation" style={{ top: tip.y }} className="pointer-events-none fixed left-[84px] z-[60] -translate-y-1/2 whitespace-nowrap rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg">
          {tip.label}
        </span>
      )}
    </>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopStrip } from "@/components/shell/TopStrip";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Route guard: signed in, password set, and the right area for the role.
  const isAdminArea = pathname.startsWith("/dashboard/admin");
  const isStaff = user?.role === "ADMIN" || user?.role === "HR";
  const redirectTo = isLoading
    ? null
    : !user
      ? "/login"
      : user.mustChangePassword
        ? "/force-password-reset"
        : user.role === "SUPER_ADMIN"
          ? "/platform-admin"
          : isAdminArea && !isStaff
            ? "/dashboard/employee"
            : null;
  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  // Restore collapsed preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rostra_sidebar_collapsed");
      if (saved !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore preference after mount
        setIsCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("rostra_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isLoading || !user || redirectTo) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#f4f5ff]" role="status" aria-live="polite">
        <span className="text-sm text-slate-600">Loading your workspace…</span>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#f4f5ff] text-stone-900 selection:bg-teal-700/20">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:m-2 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold">
        Skip to content
      </a>
      <Sidebar
        collapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <main id="main" tabIndex={-1} className="h-full min-w-0 flex-1 overflow-y-auto p-4 focus:outline-none sm:p-6 lg:px-10 lg:py-8">
        <div className="fluid-container">
          <TopStrip onOpenMenu={() => setMobileSidebarOpen(true)} />
          {children}
        </div>
      </main>
    </div>
  );
}

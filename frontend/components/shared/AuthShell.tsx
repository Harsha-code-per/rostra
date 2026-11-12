import React from "react";
import { Logo } from "./Logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f4f5ff] text-slate-900 flex flex-col font-sans">
      <main id="main" className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-6 gap-3">
            <Logo className="h-10 w-10" />
            <h1 className="text-2xl font-bold font-heading">{title}</h1>
            {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 pt-4 border-t border-slate-100 text-center text-sm text-slate-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 text-sm";
export const primaryBtn =
  "w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600";

"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

const links = [
  { href: "#attendance", label: "Product" },
  { href: "#trust", label: "Trust" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";
  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 sm:px-6">
      <nav aria-label="Primary" className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-[#10113a]/10 bg-[#f4f5ff]/85 py-2 pl-4 pr-2 shadow-[0_8px_30px_-12px_rgba(28,25,23,0.25)] backdrop-blur-md">
        <Logo className="h-8 w-8" />
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => <a key={l.href} href={l.href} className={`rounded-full px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-200/60 ${focus}`}>{l.label}</a>)}
          <Link href="/login" className={`rounded-full px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-200/60 ${focus}`}>Sign in</Link>
          <Link href="/contact" className={`ml-1 rounded-full bg-[#10113a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3b3bf2] ${focus}`}>Request a workspace</Link>
        </div>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} className={`grid h-10 w-10 place-items-center rounded-full text-stone-900 hover:bg-stone-200/60 md:hidden ${focus}`}>
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>
      {open && (
        <div id="mobile-menu" className="mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-3xl border border-stone-200 bg-[#f4f5ff] p-3 shadow-xl md:hidden">
          {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)} className={`rounded-2xl px-4 py-3 text-base font-medium text-stone-900 hover:bg-stone-200/60 ${focus}`}>{l.label}</a>)}
          <Link href="/login" className={`rounded-2xl px-4 py-3 text-base font-medium text-stone-900 hover:bg-stone-200/60 ${focus}`}>Sign in</Link>
          <Link href="/contact" className={`rounded-2xl bg-stone-900 px-4 py-3 text-center text-base font-semibold text-white ${focus}`}>Request a workspace</Link>
        </div>
      )}
    </header>
  );
}

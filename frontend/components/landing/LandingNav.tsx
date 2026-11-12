"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

// Each link lights up while any of its sections is under the middle of the screen.
const links = [
  { href: "#order", label: "Product", spy: ["order", "attendance", "leave", "payroll"] },
  { href: "#trust", label: "Trust", spy: ["trust"] },
];
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b3bf2]";

/**
 * At the top of the page there is no bar: just the mark, the name and the links on the page itself.
 * After a little scrolling the same elements gather into a floating pill.
 */
export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 32);
      const mid = window.innerHeight / 2;
      const hit = links.find((l) =>
        l.spy.some((id) => {
          const r = document.getElementById(id)?.getBoundingClientRect();
          return r && r.top <= mid && r.bottom > mid;
        }),
      );
      setActive(hit?.href ?? null);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const link = (href: string, label: string, current: boolean, onClick?: () => void) => (
    <a
      key={href}
      href={href}
      onClick={onClick}
      aria-current={current ? "location" : undefined}
      className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-[#10113a]/[0.06] motion-reduce:transition-none ${current ? "text-[#3b3bf2]" : "text-[#10113a]"} ${focus}`}
    >
      {label}
      <span aria-hidden="true" className={`absolute inset-x-0 -bottom-0.5 mx-auto h-1 w-1 rounded-full bg-[#ff6b3d] transition-transform duration-300 ${current ? "scale-100" : "scale-0"}`} />
    </a>
  );

  return (
    <header className={`fixed inset-x-0 top-0 z-50 flex flex-col items-center transition-[padding] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${scrolled ? "px-3 pt-3" : "px-0 pt-0"}`}>
      <nav
        aria-label="Primary"
        className={`flex w-full items-center justify-between border transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${
          scrolled
            ? "max-w-[41rem] rounded-full border-[#10113a]/10 bg-[#f4f5ff]/75 py-1.5 pl-4 pr-1.5 shadow-[0_14px_40px_-16px_rgba(16,17,58,0.35)] backdrop-blur-xl"
            : "max-w-[120rem] rounded-none border-transparent bg-transparent px-5 py-5 sm:px-10 lg:px-16"
        }`}
      >
        <Logo className="h-8 w-8" />
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => link(l.href, l.label, active === l.href))}
          <Link href="/login" className={`rounded-full px-4 py-2 text-sm font-medium text-[#10113a] transition-colors hover:bg-[#10113a]/[0.06] ${focus}`}>Sign in</Link>
          <Link href="/contact" className={`ml-1 rounded-full bg-[#10113a] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3b3bf2] ${focus}`}>Request a workspace</Link>
        </div>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} className={`grid h-10 w-10 place-items-center rounded-full text-[#10113a] hover:bg-[#10113a]/[0.06] md:hidden ${focus}`}>
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>
      <div
        id="mobile-menu"
        className={`${open ? "flex" : "hidden"} mt-2 w-full max-w-[41rem] flex-col gap-1 rounded-3xl border border-[#10113a]/10 bg-[#f4f5ff]/95 p-3 shadow-xl backdrop-blur-xl md:hidden!`}
      >
        {links.map((l) => link(l.href, l.label, active === l.href, () => setOpen(false)))}
        <Link href="/login" className={`rounded-full px-4 py-3 text-sm font-medium text-[#10113a] hover:bg-[#10113a]/[0.06] ${focus}`}>Sign in</Link>
        <Link href="/contact" className={`rounded-full bg-[#10113a] px-4 py-3 text-center text-sm font-semibold text-white ${focus}`}>Request a workspace</Link>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

// Each link lights up while any of its sections is under the middle of the screen.
const links = [
  { href: "#order", label: "Product", spy: ["order", "attendance", "leave", "payroll"] },
  { href: "#trust", label: "Trust", spy: ["trust"] },
  { href: "#pricing", label: "Pricing", spy: ["pricing"] },
];

/**
 * A full-width bar fixed to the top. On the hero it is bare (mark, name, links). After a little
 * scrolling it gains a frosted background and a hairline, and nothing moves or resizes.
 * Over the dark sections it switches to light text on ink.
 */
export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      setDark(Array.from(document.querySelectorAll("[data-nav-dark]")).some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= 32 && r.bottom > 32;
      }));
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

  const ink = dark ? "text-white" : "text-[#10113a]";
  const hover = dark ? "hover:bg-white/10" : "hover:bg-[#10113a]/[0.06]";
  const focus = `focus-visible:outline-2 focus-visible:outline-offset-2 ${dark ? "focus-visible:outline-white" : "focus-visible:outline-[#3b3bf2]"}`;
  const solid = scrolled || open;

  const link = (href: string, label: string, current: boolean, onClick?: () => void) => (
    <a
      key={href}
      href={href}
      onClick={onClick}
      aria-current={current ? "location" : undefined}
      className={`relative inline-block rounded-full px-4 py-2 text-sm font-medium transition-colors motion-reduce:transition-none ${hover} ${current ? (dark ? "text-[#ff6b3d]" : "text-[#3b3bf2]") : ink} ${focus}`}
    >
      {label}
      <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 mx-auto h-1 w-1 rounded-full bg-[#ff6b3d] transition-transform duration-300 ${current ? "scale-100" : "scale-0"}`} />
    </a>
  );

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300 motion-reduce:transition-none ${
        solid
          ? dark
            ? "border-white/10 bg-[#10113a]/85 backdrop-blur-xl"
            : "border-[#10113a]/10 bg-[#f4f5ff]/85 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <nav aria-label="Primary" className="flex h-16 items-center justify-between px-5 sm:px-10 lg:px-16">
        <Logo className="h-8 w-8" wordmarkClassName={ink} />
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => link(l.href, l.label, active === l.href))}
          <Link href="/login" className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${ink} ${hover} ${focus}`}>Sign in</Link>
          <Link href="/contact" className={`ml-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${dark ? "bg-white text-[#10113a] hover:bg-[#ff6b3d]" : "bg-[#10113a] text-white hover:bg-[#3b3bf2]"} ${focus}`}>Request a workspace</Link>
        </div>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} className={`grid h-10 w-10 place-items-center rounded-full md:hidden ${ink} ${hover} ${focus}`}>
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>
      <div id="mobile-menu" className={`${open ? "flex" : "hidden"} flex-col gap-1 border-t border-[#10113a]/10 px-5 pb-4 pt-2 sm:px-10 md:hidden!`}>
        {links.map((l) => link(l.href, l.label, active === l.href, () => setOpen(false)))}
        <Link href="/login" className={`rounded-full px-4 py-3 text-sm font-medium ${ink} ${hover} ${focus}`}>Sign in</Link>
        <Link href="/contact" className={`rounded-full bg-[#10113a] px-4 py-3 text-center text-sm font-semibold text-white ${dark ? "!bg-white !text-[#10113a]" : ""} ${focus}`}>Request a workspace</Link>
      </div>
    </header>
  );
}

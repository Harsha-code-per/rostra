"use client";

import { useEffect, useRef } from "react";

/** A statement whose words fill in as it scrolls through the viewport. Fully readable without JS or with reduced motion. */
export function FillText({ children, className = "" }: { children: string; className?: string }) {
  const root = useRef<HTMLParagraphElement>(null);
  const words = children.split(" ");

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.82 - r.top) / (r.height + window.innerHeight * 0.25)));
      const f = p * (spans.length + 6);
      spans.forEach((s, i) => (s.style.opacity = String(0.58 + 0.42 * Math.min(1, Math.max(0, f - i)))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <p ref={root} className={className}>
      {words.map((w, i) => (
        <span key={i} data-w className="transition-opacity duration-150">{w}{i < words.length - 1 ? " " : ""}</span>
      ))}
    </p>
  );
}

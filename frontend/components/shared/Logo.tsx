import Link from "next/link";

// Single source for the brand mark (public/logo.svg).
export function Logo({ className = "h-8 w-8", withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Rostra home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" className={`${className} object-contain`} />
      {withWordmark && <span className="font-heading font-extrabold text-lg tracking-tight text-slate-900">Rostra</span>}
    </Link>
  );
}

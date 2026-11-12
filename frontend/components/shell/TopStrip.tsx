"use client";

import React, { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { NotificationBell } from "./NotificationBell";

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the clock after mount to avoid a hydration mismatch
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Date, time and notifications at the very top of the page. Not a navbar: no background, no brand. */
export function TopStrip({ onOpenMenu }: { onOpenMenu: () => void }) {
  const now = useNow();
  const day = now?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const time = now?.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
      <div className="flex items-center gap-3">
        <button onClick={onOpenMenu} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-800 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 lg:hidden">
          <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <p className="min-h-[1.5rem] text-sm text-stone-700" aria-label="Current date and time">
          {now && (
            <>
              <span className="hidden sm:inline">{day} · </span>
              <time dateTime={now.toISOString()} className="font-semibold text-stone-900 tabular-nums">{time}</time>
            </>
          )}
        </p>
      </div>
      <NotificationBell />
    </div>
  );
}

"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface DialogProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Modal built on the native <dialog>: focus trap, Escape to close, inert background and focus
 * restoration come from the platform. Mount it only while open (`{open && <Dialog …/>}`).
 */
export function Dialog({ title, description, onClose, children, className = "max-w-md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${className} max-h-[90dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm`}
    >
      <div className="relative p-6 sm:p-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-600"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        <h2 id={titleId} className="pr-10 text-lg font-bold font-heading">{title}</h2>
        {description && <p id={descId} className="mt-1 text-sm text-slate-600">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { AuthShell, inputClass, primaryBtn } from "@/components/shared/AuthShell";

export default function ForcePasswordResetPage() {
  const router = useRouter();
  const { user, isLoading, resetPermanentPassword } = useAuth();
  const [temp, setTemp] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  const rules = [
    ["At least 8 characters", next.length >= 8],
    ["An uppercase letter", /[A-Z]/.test(next)],
    ["A number", /[0-9]/.test(next)],
    ["A symbol", /[^A-Za-z0-9]/.test(next)],
    ["Matches the confirmation", next.length > 0 && next === confirm],
  ] as const;
  const valid = rules.every(([, ok]) => ok);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await resetPermanentPassword(next, temp);
      toast.success("Password set. Welcome aboard.");
      router.push(user?.role === "ADMIN" || user?.role === "HR" ? "/dashboard/admin" : "/dashboard/employee");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Set your password" subtitle="Replace the temporary password you were given before you continue.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="temp" className="block text-slate-800 font-semibold text-sm mb-1.5">Temporary password</label>
          <input id="temp" type="password" autoComplete="current-password" required value={temp} onChange={(e) => setTemp(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="next" className="block text-slate-800 font-semibold text-sm mb-1.5">New password</label>
          <input id="next" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="rules" className={inputClass} />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-slate-800 font-semibold text-sm mb-1.5">Confirm new password</label>
          <input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </div>
        <ul id="rules" className="grid gap-1 text-sm">
          {rules.map(([label, ok]) => (
            <li key={label} className={`flex items-center gap-2 ${ok ? "text-emerald-800" : "text-slate-600"}`}>
              {ok ? <Check className="w-4 h-4" aria-hidden="true" /> : <X className="w-4 h-4" aria-hidden="true" />}
              <span>{label}<span className="sr-only">{ok ? " (met)" : " (not met)"}</span></span>
            </li>
          ))}
        </ul>
        <button type="submit" disabled={busy || !valid || !temp} className={primaryBtn}>{busy ? "Saving…" : "Set password"}</button>
      </form>
    </AuthShell>
  );
}

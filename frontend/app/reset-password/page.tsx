"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RostraApi } from "@/lib/api";
import { AuthShell, inputClass, primaryBtn } from "@/components/shared/AuthShell";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = password.length >= 8 && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await RostraApi.resetPassword(token, password);
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  if (!token) return <p role="alert" className="text-sm text-center text-red-700">This reset link is incomplete. Request a new one.</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="pw" className="block text-slate-800 font-semibold text-sm mb-1.5">New password</label>
        <input id="pw" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" className={inputClass} />
        <p id="pw-hint" className="text-xs text-slate-600 mt-1">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="pw2" className="block text-slate-800 font-semibold text-sm mb-1.5">Confirm password</label>
        <input id="pw2" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={confirm.length > 0 && password !== confirm} className={inputClass} />
      </div>
      <button type="submit" disabled={busy || !valid} className={primaryBtn}>{busy ? "Saving…" : "Set new password"}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" footer={<Link href="/login" className="text-cyan-800 hover:underline font-semibold">Back to sign in</Link>}>
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RostraApi } from "@/lib/api";
import { AuthShell, inputClass, primaryBtn } from "@/components/shared/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await RostraApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We will email you a link that works once." footer={<Link href="/login" className="text-cyan-800 hover:underline font-semibold">Back to sign in</Link>}>
      {sent ? (
        <p role="status" className="text-sm text-slate-700 text-center">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in one hour.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-slate-800 font-semibold text-sm mb-1.5">Work email</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
    </AuthShell>
  );
}

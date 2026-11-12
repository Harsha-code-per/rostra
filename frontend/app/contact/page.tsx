"use client";

import Link from "next/link";
import React, { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { RostraApi } from "@/lib/api";
import { AuthShell, inputClass, primaryBtn } from "@/components/shared/AuthShell";

type Plan = "Starter" | "Growth" | "Enterprise";
const SIZES = ["1-10", "11-25", "25-50", "50-200", "200+"];

export default function ContactPage() {
  const [f, setF] = useState({ companyName: "", contactName: "", workEmail: "", phone: "", teamSize: "25-50", planInterest: "Growth" as Plan, message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await RostraApi.submitInquiry({ ...f, message: f.message.trim() || `Interested in the ${f.planInterest} plan for ${f.teamSize} people.` });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: string, el: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-stone-900 mb-1.5">{label}</label>
      {el}
      {hint && <p className="mt-1 text-xs text-stone-600">{hint}</p>}
    </div>
  );

  const done_ = (
    <div role="status" className="py-6 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-700" aria-hidden="true" />
      <h2 className="mt-4 font-heading text-2xl font-semibold">Thank you, we have it.</h2>
      <p className="mt-2 text-stone-700">We will email <strong>{f.workEmail}</strong> once your workspace is ready.</p>
      <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-stone-800 hover:underline focus-visible:outline-2 focus-visible:outline-[#3b3bf2]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home</Link>
    </div>
  );

  return (
    <AuthShell
      wide
      title={done ? "Request received" : "Request a workspace"}
      subtitle={done ? undefined : "We set up your workspace and your first admin by hand, then send you the sign-in details. No payment details needed."}
      footer={
        done ? undefined : (
          <div className="flex flex-col items-center gap-4">
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-stone-700">
              {["Attendance, leave and payroll from day one", "Your data sealed from every other company", "A real person replies, usually within a working day"].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#3b3bf2]" aria-hidden="true" />{t}</li>
              ))}
            </ul>
            <Link href="/" className="inline-flex items-center gap-2 font-semibold text-stone-800 hover:underline focus-visible:outline-2 focus-visible:outline-[#3b3bf2]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home</Link>
          </div>
        )
      }
    >
      {done ? done_ : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("companyName", "Company", <input id="companyName" required minLength={2} maxLength={255} autoComplete="organization" value={f.companyName} onChange={set("companyName")} className={inputClass} />)}
            {field("contactName", "Your name", <input id="contactName" required minLength={2} maxLength={255} autoComplete="name" value={f.contactName} onChange={set("contactName")} className={inputClass} />)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("workEmail", "Work email", <input id="workEmail" type="email" required autoComplete="email" value={f.workEmail} onChange={set("workEmail")} className={inputClass} />)}
            {field("phone", "Phone (optional)", <input id="phone" type="tel" autoComplete="tel" maxLength={50} value={f.phone} onChange={set("phone")} className={inputClass} />)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("teamSize", "Team size", <select id="teamSize" value={f.teamSize} onChange={set("teamSize")} className={inputClass}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select>)}
            {field("planInterest", "Plan", <select id="planInterest" value={f.planInterest} onChange={set("planInterest")} className={inputClass}><option>Starter</option><option>Growth</option><option>Enterprise</option></select>)}
          </div>
          {field("message", "Anything we should know? (optional)", <textarea id="message" rows={3} maxLength={2000} value={f.message} onChange={set("message")} className={inputClass} />)}
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? "Sending…" : "Request my workspace"}</button>
        </form>
      )}
    </AuthShell>
  );
}

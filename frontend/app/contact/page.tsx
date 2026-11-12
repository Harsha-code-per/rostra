"use client";

import Link from "next/link";
import React, { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { RostraApi } from "@/lib/api";
import { Logo } from "@/components/shared/Logo";
import { inputClass, primaryBtn } from "@/components/shared/AuthShell";

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

  return (
    <div className="min-h-dvh bg-[#f4f5ff] text-stone-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-800 hover:underline focus-visible:outline-2 focus-visible:outline-teal-700"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home</Link>
      </header>

      <main id="main" className="mx-auto grid max-w-5xl gap-10 px-5 pb-20 pt-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Request a workspace</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Tell us about <span className="text-[#3b3bf2]">your team.</span></h1>
          <p className="mt-4 text-lg text-stone-700">We set up your workspace and your first admin by hand, then send you the sign-in details. No payment details needed to ask.</p>
          <ul className="mt-6 space-y-3 text-stone-800">
            {["Attendance, leave and payroll from day one", "Your data sealed from every other company", "A real person replies, usually within a working day"].map((t) => (
              <li key={t} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(28,25,23,0.4)] sm:p-8">
          {done ? (
            <div role="status" className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-700" aria-hidden="true" />
              <h2 className="mt-4 font-heading text-2xl font-semibold">Thank you, we have it.</h2>
              <p className="mt-2 text-stone-700">We will email <strong>{f.workEmail}</strong> once your workspace is ready.</p>
            </div>
          ) : (
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
        </div>
      </main>
    </div>
  );
}

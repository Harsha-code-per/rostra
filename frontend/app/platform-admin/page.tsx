"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Copy, Inbox, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { RostraApi } from "@/lib/api";
import type { CompanyInquiry, CompanyTenant } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Dialog } from "@/components/shared/Dialog";
import { Logo } from "@/components/shared/Logo";
import { inputClass } from "@/components/shared/AuthShell";

type Plan = CompanyTenant["plan"];
interface Prefill { name: string; adminName: string; adminEmail: string; plan: Plan; inquiryId?: string }

function ProvisionDialog({ prefill, onClose, onDone }: { prefill: Prefill; onClose: () => void; onDone: (c: CompanyTenant, pass: string) => void }) {
  const [f, setF] = useState({ name: prefill.name, adminName: prefill.adminName, adminEmail: prefill.adminEmail, plan: prefill.plan, maxEmployees: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await RostraApi.provisionCompany({ name: f.name, adminName: f.adminName, adminEmail: f.adminEmail, plan: f.plan, maxEmployees: f.maxEmployees ? Number(f.maxEmployees) : undefined });
      if (prefill.inquiryId) await RostraApi.updateInquiryStatus(prefill.inquiryId, "PROVISIONED").catch(() => undefined);
      onDone(res.company, res.temporaryPassword);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the workspace");
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: string, el: React.ReactNode) => (
    <div><label htmlFor={id} className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</label>{el}</div>
  );

  return (
    <Dialog title="Create a customer workspace" description="Creates the company and its first admin login." onClose={onClose} className="max-w-lg">
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        {field("pv-name", "Company name", <input id="pv-name" required minLength={2} maxLength={255} value={f.name} onChange={set("name")} className={inputClass} />)}
        <div className="grid grid-cols-2 gap-3">
          {field("pv-admin", "Admin name", <input id="pv-admin" required minLength={2} maxLength={255} value={f.adminName} onChange={set("adminName")} className={inputClass} />)}
          {field("pv-email", "Admin email", <input id="pv-email" type="email" required value={f.adminEmail} onChange={set("adminEmail")} className={inputClass} />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("pv-plan", "Plan", <select id="pv-plan" value={f.plan} onChange={set("plan")} className={inputClass}><option>Starter</option><option>Growth</option><option>Enterprise</option></select>)}
          {field("pv-max", "Employee limit", <input id="pv-max" type="number" min={1} placeholder="Unlimited" value={f.maxEmployees} onChange={set("maxEmployees")} className={inputClass} />)}
        </div>
        <div className="flex justify-end gap-2.5 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-sm focus-visible:outline-2 focus-visible:outline-cyan-600">Cancel</button>
          <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">{busy ? "Creating…" : "Create workspace"}</button>
        </div>
      </form>
    </Dialog>
  );
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [companies, setCompanies] = useState<CompanyTenant[] | null>(null);
  const [inquiries, setInquiries] = useState<CompanyInquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [created, setCreated] = useState<{ company: CompanyTenant; pass: string } | null>(null);

  useEffect(() => {
    if (!isLoading && user?.role !== "SUPER_ADMIN") router.replace("/platform-admin/login");
  }, [isLoading, user, router]);

  const load = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([RostraApi.getCompanies(), RostraApi.getInquiries()]);
      setCompanies(c);
      setInquiries(i);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the console");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    if (user?.role === "SUPER_ADMIN") load();
  }, [user, load]);

  const toggle = async (c: CompanyTenant) => {
    const next = c.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    if (next === "SUSPENDED" && !window.confirm(`Suspend ${c.name}? Everyone in the company is signed out and locked out until you reactivate it.`)) return;
    try {
      await RostraApi.setCompanyStatus(c.id, next);
      toast.success(`${c.name} ${next === "ACTIVE" ? "reactivated" : "suspended"}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the status");
    }
  };

  const markContacted = async (i: CompanyInquiry) => {
    try {
      await RostraApi.updateInquiryStatus(i.id, "CONTACTED");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the inquiry");
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`Workspace: ${created.company.name}\nEmail: ${created.company.adminEmail}\nTemporary password: ${created.pass}\nSign in: ${window.location.origin}/login`);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed. Select the text and copy it manually.");
    }
  };

  if (isLoading || user?.role !== "SUPER_ADMIN") return <p role="status" className="p-8 text-sm text-slate-600">Loading…</p>;

  const open = inquiries.filter((i) => i.status !== "PROVISIONED");
  return (
    <div className="min-h-dvh bg-[#f4f5ff] text-slate-900">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <span className="flex items-center gap-3"><Logo /><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white">Platform console</span></span>
        <button onClick={() => { logout(); router.push("/platform-admin/login"); }} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-cyan-600"><LogOut className="w-4 h-4" aria-hidden="true" /> Sign out</button>
      </header>

      <main id="main" className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading">Customers</h1>
            <p className="text-sm text-slate-600">{companies ? `${companies.length} workspaces, ${open.length} open inquiries` : "Loading…"}</p>
          </div>
          <button onClick={() => setPrefill({ name: "", adminName: "", adminEmail: "", plan: "Growth" })} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"><Plus className="w-4 h-4" aria-hidden="true" /> New workspace</button>
        </div>

        {error && <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>}

        <section aria-labelledby="companies" className="rounded-3xl bg-white border border-slate-200 overflow-x-auto">
          <h2 id="companies" className="px-6 pt-5 pb-3 text-sm font-bold flex items-center gap-2"><Building2 className="w-4 h-4 text-cyan-700" aria-hidden="true" /> Workspaces</h2>
          {companies && companies.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600">No workspaces yet. Create one from an inquiry or with the button above.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Customer workspaces</caption>
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-700"><tr>
                <th scope="col" className="py-3 px-6 font-semibold">Company</th>
                <th scope="col" className="py-3 font-semibold">Admin</th>
                <th scope="col" className="py-3 font-semibold">Plan</th>
                <th scope="col" className="py-3 font-semibold">Employees</th>
                <th scope="col" className="py-3 font-semibold">Status</th>
                <th scope="col" className="py-3 px-6 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {companies?.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3.5 px-6"><span className="font-bold block">{c.name}</span><span className="text-xs text-slate-600">Since {c.createdAt ? formatDate(c.createdAt) : "—"}</span></td>
                    <td className="py-3.5"><span className="block">{c.adminName}</span><span className="text-xs text-slate-600">{c.adminEmail}</span></td>
                    <td className="py-3.5">{c.plan}</td>
                    <td className="py-3.5 font-mono">{c.employeeCount}{c.maxEmployees ? ` / ${c.maxEmployees}` : ""}</td>
                    <td className="py-3.5"><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-rose-50 text-rose-800 border-rose-300"}`}>{c.status.replace("_", " ")}</span></td>
                    <td className="py-3.5 px-6 text-right"><button onClick={() => toggle(c)} aria-label={`${c.status === "SUSPENDED" ? "Reactivate" : "Suspend"} ${c.name}`} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-xs focus-visible:outline-2 focus-visible:outline-cyan-600">{c.status === "SUSPENDED" ? "Reactivate" : "Suspend"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-labelledby="inquiries" className="rounded-3xl bg-white border border-slate-200 p-6">
          <h2 id="inquiries" className="text-sm font-bold flex items-center gap-2 mb-4"><Inbox className="w-4 h-4 text-cyan-700" aria-hidden="true" /> Inquiries from the website</h2>
          {inquiries.length === 0 ? <p className="text-sm text-slate-600">No inquiries yet.</p> : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inquiries.map((i) => (
                <li key={i.id} className="p-5 rounded-2xl border border-slate-200 flex flex-col gap-2 text-sm">
                  <div className="flex items-start justify-between gap-3"><span className="font-bold text-base">{i.companyName}</span><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100">{i.status}</span></div>
                  <p>{i.contactName} · <a className="text-cyan-800 underline" href={`mailto:${i.workEmail}`}>{i.workEmail}</a>{i.phone ? ` · ${i.phone}` : ""}</p>
                  <p className="text-slate-700">{i.teamSize} people · interested in {i.planInterest}</p>
                  {i.message && <p className="text-slate-700">&ldquo;{i.message}&rdquo;</p>}
                  <p className="text-xs text-slate-600">{i.createdAt ? formatDate(i.createdAt) : ""}</p>
                  {i.status !== "PROVISIONED" && (
                    <div className="flex gap-2 pt-1">
                      {i.status === "NEW" && <button onClick={() => markContacted(i)} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-xs focus-visible:outline-2 focus-visible:outline-cyan-600">Mark contacted</button>}
                      <button onClick={() => setPrefill({ name: i.companyName, adminName: i.contactName, adminEmail: i.workEmail, plan: i.planInterest, inquiryId: i.id })} className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">Create workspace</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {prefill && <ProvisionDialog prefill={prefill} onClose={() => setPrefill(null)} onDone={(company, pass) => { setPrefill(null); setCreated({ company, pass }); load(); }} />}
      {created && (
        <Dialog title="Workspace ready" description="Send these details to the admin. The password is shown once." onClose={() => setCreated(null)}>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-mono space-y-2 mb-5 break-all">
            <p>Workspace: <strong>{created.company.name}</strong></p>
            <p>Email: <strong>{created.company.adminEmail}</strong></p>
            <p>Temporary password: <strong className="text-rose-800 select-all">{created.pass}</strong></p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={copy} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-sm focus-visible:outline-2 focus-visible:outline-cyan-600"><Copy className="w-4 h-4" aria-hidden="true" /> Copy</button>
            <button onClick={() => setCreated(null)} className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">Done</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

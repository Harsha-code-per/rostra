"use client";

import React, { useEffect, useState } from "react";
import { Calendar, Edit3, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { RostraApi } from "@/lib/api";
import type { Employee } from "@/lib/types";
import { EmployeeEditDrawer } from "@/components/employees/EmployeeEditDrawer";
import { AvatarBadge } from "@/components/shared/AvatarBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

const Item = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm">
    <dt className="text-slate-700 flex items-center gap-2"><Icon className="w-4 h-4 text-slate-600" aria-hidden="true" /> {label}</dt>
    <dd className="font-semibold text-slate-900 text-right">{value || "Not provided"}</dd>
  </div>
);

export default function EmployeeProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    RostraApi.getMyEmployee().then(setEmployee).catch((e) => setError(e instanceof Error ? e.message : "Could not load your profile"));
  }, []);

  if (error) return <p role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>;
  if (!employee) return <p role="status" className="text-sm text-slate-600">Loading profile…</p>;

  const ec = employee.emergencyContact;
  return (
    <div className="flex flex-col gap-6">
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <AvatarBadge name={`${employee.firstName} ${employee.lastName}`} department={employee.department} size="xl" status={employee.status} showStatus />
          <div>
            <h1 className="text-2xl font-bold font-heading text-slate-900">{employee.firstName} {employee.lastName}</h1>
            <p className="text-sm text-cyan-900 font-semibold">{employee.designation} · {employee.department}</p>
            <p className="text-sm text-slate-600 font-mono">{employee.employeeId}</p>
          </div>
        </div>
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
          <Edit3 className="w-4 h-4 text-cyan-700" aria-hidden="true" /> Edit details
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-labelledby="contact" className="rounded-3xl p-6 bg-white border border-slate-200 shadow-sm">
          <h2 id="contact" className="text-sm font-bold mb-4 pb-3 border-b border-slate-100">Contact</h2>
          <dl className="flex flex-col gap-3">
            <Item icon={Mail} label="Email" value={employee.email} />
            <Item icon={Phone} label="Phone" value={employee.phone} />
            <Item icon={MapPin} label="Address" value={employee.address} />
            <Item icon={Calendar} label="Joined" value={employee.joiningDate ? formatDate(employee.joiningDate) : ""} />
          </dl>
        </section>
        <section aria-labelledby="emergency" className="rounded-3xl p-6 bg-white border border-slate-200 shadow-sm">
          <h2 id="emergency" className="text-sm font-bold mb-4 pb-3 border-b border-slate-100">Emergency contact &amp; pay</h2>
          <dl className="flex flex-col gap-3">
            <Item icon={ShieldCheck} label="Name" value={ec?.name ?? ""} />
            <Item icon={ShieldCheck} label="Relationship" value={ec?.relationship ?? ""} />
            <Item icon={Phone} label="Phone" value={ec?.phone ?? ""} />
          </dl>
          <p className="mt-4 p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200 text-sm text-cyan-950">
            Monthly gross: <strong className="font-mono">{formatCurrency(employee.wage)}</strong>
          </p>
        </section>
      </div>

      <EmployeeEditDrawer employee={employee} isOpen={editing} onClose={() => setEditing(false)} onSaved={setEmployee} />
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import type { Employee, EmployeeStatus } from "@/lib/types";
import { RostraApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Dialog } from "@/components/shared/Dialog";
import { inputClass } from "@/components/shared/AuthShell";

interface Props {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Employee) => void;
}

const Field = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</label>
    {children}
  </div>
);

function EditForm({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: (e: Employee) => void }) {
  const { user, updateCurrentUserEmployee } = useAuth();
  const isStaff = user?.role === "ADMIN" || user?.role === "HR";
  const [f, setF] = useState({
    phone: employee.phone,
    address: employee.address,
    department: employee.department,
    designation: employee.designation,
    status: employee.status as EmployeeStatus,
    ecName: employee.emergencyContact?.name ?? "",
    ecRel: employee.emergencyContact?.relationship ?? "",
    ecPhone: employee.emergencyContact?.phone ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updates: Partial<Employee> = {
        phone: f.phone,
        address: f.address,
        emergencyContact: { name: f.ecName, relationship: f.ecRel, phone: f.ecPhone },
        ...(isStaff ? { department: f.department, designation: f.designation, status: f.status } : {}),
      };
      const saved = await RostraApi.updateEmployee(employee.employeeId, updates);
      if (user?.employee.employeeId === employee.employeeId) updateCurrentUserEmployee(saved);
      toast.success("Profile updated");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {isStaff && (
        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-cyan-900">HR controls</legend>
          <Field id="ed-dept" label="Department"><input id="ed-dept" value={f.department} onChange={set("department")} required maxLength={100} className={inputClass} /></Field>
          <Field id="ed-desig" label="Designation"><input id="ed-desig" value={f.designation} onChange={set("designation")} required maxLength={100} className={inputClass} /></Field>
          <Field id="ed-status" label="Status">
            <select id="ed-status" value={f.status} onChange={set("status")} className={inputClass}>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </Field>
        </fieldset>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="ed-phone" label="Phone"><input id="ed-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} maxLength={50} className={inputClass} /></Field>
        <Field id="ed-addr" label="Address"><input id="ed-addr" autoComplete="street-address" value={f.address} onChange={set("address")} className={inputClass} /></Field>
      </div>
      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-700">Emergency contact</legend>
        <Field id="ed-ecn" label="Name"><input id="ed-ecn" value={f.ecName} onChange={set("ecName")} className={inputClass} /></Field>
        <Field id="ed-ecr" label="Relationship"><input id="ed-ecr" value={f.ecRel} onChange={set("ecRel")} className={inputClass} /></Field>
        <Field id="ed-ecp" label="Phone"><input id="ed-ecp" type="tel" value={f.ecPhone} onChange={set("ecPhone")} className={inputClass} /></Field>
      </fieldset>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm focus-visible:outline-2 focus-visible:outline-cyan-600">Cancel</button>
        <button type="submit" disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
          <Save className="w-4 h-4" aria-hidden="true" /> {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function EmployeeEditDrawer({ employee, isOpen, onClose, onSaved }: Props) {
  if (!isOpen || !employee) return null;
  return (
    <Dialog title="Edit profile" description={`${employee.firstName} ${employee.lastName} (${employee.employeeId})`} onClose={onClose} className="max-w-xl">
      <EditForm employee={employee} onClose={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { AuthShell, inputClass, primaryBtn } from "@/components/shared/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const { login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const session = await login(email.trim(), password);
      if (session.role === "SUPER_ADMIN") {
        logout();
        toast.error("Platform staff sign in at /platform-admin/login.");
        return;
      }
      if (session.mustChangePassword) router.push("/force-password-reset");
      else if (session.role === "ADMIN" || session.role === "HR") router.push("/dashboard/admin");
      else router.push("/dashboard/employee");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Rostra workspace"
      footer={
        <Link href="/contact" className="text-cyan-800 hover:underline font-semibold">
          Need a workspace? Talk to us
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-slate-800 font-semibold text-sm mb-1.5">Work email</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputClass} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-slate-800 font-semibold text-sm">Password</label>
            <Link href="/forgot-password" className="text-xs text-cyan-800 hover:underline">Forgot password?</Link>
          </div>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        <button type="submit" disabled={isLoading} className={primaryBtn}>
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}

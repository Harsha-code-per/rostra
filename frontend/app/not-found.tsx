import Link from "next/link";
import { AuthShell } from "@/components/shared/AuthShell";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <AuthShell title="Page not found" subtitle="That page does not exist, or it has moved.">
      <Link href="/" className="block w-full rounded-xl bg-slate-900 py-3 text-center text-sm font-bold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
        Back to home
      </Link>
    </AuthShell>
  );
}

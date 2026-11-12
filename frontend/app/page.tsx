import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";
import { SceneLoader } from "@/components/landing/SceneLoader";
import { FillText } from "@/components/landing/FillText";
import { Marquee } from "@/components/landing/Marquee";
import { TodayPodium } from "@/components/landing/TodayPodium";
import { CheckInDemo, LeaveDemo, PayslipDemo } from "@/components/landing/Widgets";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3b3bf2]";
const INK = "text-[#10113a]";
const MUTED = "text-[#3a3b66]";

/** One scroll act of the 3D film. The scene reads [data-act] to know which arrangement to morph into. */
function Act({ id, title, children }: { id: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section id={id} data-act className="flex min-h-svh items-end bg-gradient-to-t from-[#f4f5ff] via-[#f4f5ff]/90 to-transparent px-5 pb-16 pt-28 sm:px-10 lg:items-center lg:bg-gradient-to-r lg:from-[#f4f5ff] lg:from-35% lg:via-[#f4f5ff]/80 lg:via-47% lg:to-transparent lg:to-60% lg:px-16 lg:pb-0">
      <div className="max-w-2xl">
        <h2 className={`font-heading text-[clamp(2.5rem,5.2vw,4.8rem)] font-bold leading-[0.92] tracking-[-0.045em] ${INK}`}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
const body = `mt-5 max-w-md text-lg leading-relaxed ${MUTED}`;

export default function LandingPage() {
  return (
    <div className={INK}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold">Skip to content</a>
      <SceneLoader />
      <LandingNav />

      <main id="main" className="relative z-10">
        {/* Hero: a big headline and the day's numbers as a podium. */}
        <section className="grid min-h-svh gap-10 bg-[#f4f5ff] px-5 pb-14 pt-32 sm:px-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:px-16">
          <div>
            <h1 className="rise font-heading text-[clamp(3.5rem,11.4vw,10.5rem)] font-bold leading-[0.84] tracking-[-0.045em] text-[#3b3bf2]">
              Count everyone <span className={INK}>in.</span>
            </h1>
            <p className={`rise mt-8 max-w-xl text-xl leading-relaxed ${MUTED}`} style={{ animationDelay: "0.15s" }}>
              Attendance, leave and payroll for Indian teams. One workspace, one source of truth, and no more Monday spreadsheets.
            </p>
            <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.25s" }}>
              <Link href="/contact" className={`inline-flex items-center gap-2 rounded-full bg-[#10113a] px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-[#3b3bf2] ${focus}`}>
                Request a workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#film" className={`rounded-full border-[1.5px] border-[#10113a] px-7 py-4 text-base font-semibold transition-colors hover:bg-white ${focus}`}>See how it works</a>
            </div>
          </div>
          <TodayPodium />
        </section>

        <Marquee />

        {/* The problem, said once, large. Words fill in as you scroll. */}
        <section className="bg-[#10113a] px-5 py-32 sm:px-10 lg:px-16 lg:py-44">
          <FillText className="mx-auto max-w-5xl font-heading text-[clamp(1.9rem,4.6vw,4.4rem)] font-bold leading-[1.08] tracking-[-0.035em] text-white">
            Every HR team has the same Monday. A sheet for attendance, a chat thread for leave, a calculator for payroll. Rostra puts all three in one place, so the month closes itself.
          </FillText>
        </section>

        {/* The film: the 3D scene shows through these transparent sections. */}
        <div id="film">
          <Act id="mess" title={<>Monday, <br />9:02 a.m.</>}>
            <p className={body}>Forty requests, three spreadsheets and a payslip due Friday. This is what HR looks like without a system.</p>
          </Act>
          <Act id="order" title={<>One place <br />for all of it.</>}>
            <p className={body}>Every check-in, leave request and payslip gets a single home. Nothing to chase and nothing to reconcile.</p>
          </Act>
          <Act id="attendance" title={<>Know who <br />is in.</>}>
            <p className={body}>One-tap check-in and out, a company board for any date, and manual corrections that keep a note of what changed.</p>
            <div className="mt-6"><CheckInDemo /></div>
          </Act>
          <Act id="leave" title={<>Decide in <br />two clicks.</>}>
            <p className={body}>Requests arrive with balances attached. Approve once and attendance updates itself. A request can be decided only one time, so nothing is counted twice.</p>
            <div className="mt-6"><LeaveDemo /></div>
          </Act>
          <Act id="payroll" title={<>Pay without <br />the maths.</>}>
            <p className={body}>Basic, HRA, PF and professional tax come from the wage and the days actually worked. Rostra calculates and exports. It never moves your money.</p>
            <div className="mt-6"><PayslipDemo /></div>
          </Act>
          <Act id="trust" title={<>Your people data <br />stays yours.</>}>
            <ul className={`mt-6 flex max-w-md flex-col gap-4 ${MUTED}`}>
              <li><strong className={INK}>Sealed workspaces.</strong> Every company is its own workspace, and we test that one can never see another.</li>
              <li><strong className={INK}>Strict roles.</strong> Platform staff, admins, HR and employees each see only what they should. Nobody can promote themselves.</li>
              <li><strong className={INK}>Careful with passwords.</strong> Hashed with bcrypt, rate-limited sign-in, and a password change signs out every other session.</li>
              <li><strong className={INK}>A kill switch.</strong> Suspend a workspace and everyone in it is locked out at once.</li>
            </ul>
          </Act>
        </div>

        {/* Close: one blue panel. */}
        <section className="bg-[#f4f5ff] px-4 py-10 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-8 rounded-[2.5rem] bg-[#3b3bf2] px-7 py-16 text-white sm:px-14 sm:py-24">
            <h2 className="max-w-[9em] font-heading text-[clamp(2.8rem,7vw,7rem)] font-bold leading-[0.9] tracking-[-0.05em]">Give HR their afternoons back.</h2>
            <Link href="/contact" className={`inline-flex items-center gap-2 rounded-full bg-[#ff6b3d] px-8 py-4 text-base font-semibold text-[#10113a] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white`}>
              Request a workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 overflow-hidden bg-[#10113a] px-5 pt-14 text-white sm:px-10 lg:px-16">
        <div className="flex flex-wrap items-center justify-between gap-6 text-sm">
          <p className="text-white/75">© 2026 Harshavardhan K and Cholan Kinnera. All rights reserved.</p>
          <nav aria-label="Footer" className="flex gap-6 font-medium">
            <Link href="/login" className={`hover:underline ${focus}`}>Sign in</Link>
            <Link href="/contact" className={`hover:underline ${focus}`}>Request a workspace</Link>
          </nav>
        </div>
        <p aria-hidden="true" className="mt-10 select-none translate-y-[0.12em] font-heading text-[clamp(6rem,24vw,30rem)] font-bold leading-[0.8] tracking-[-0.05em] text-[#6b6bff]">Rostra</p>
      </footer>
    </div>
  );
}

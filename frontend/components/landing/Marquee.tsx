const WORDS = ["Attendance", "Leave", "Payroll", "PF", "HRA", "Payslips", "Professional tax", "Approvals"];

export function Marquee() {
  const run = (key: string) => (
    <span key={key} className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={key !== "a"}>
      {WORDS.map((w) => (
        <span key={w} className="flex items-center gap-8">
          <span>{w}</span>
          <span aria-hidden="true" className="h-[0.34em] w-[0.34em] rounded-full bg-[#10113a]" />
        </span>
      ))}
    </span>
  );
  return (
    <div className="marquee overflow-hidden bg-[#ff6b3d] py-5 font-heading text-[clamp(1.5rem,3.4vw,3rem)] font-extrabold uppercase leading-none tracking-[-0.02em] text-[#10113a]">
      <div className="marquee-track flex w-max">{run("a")}{run("b")}</div>
    </div>
  );
}

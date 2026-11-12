/** A live-feeling "today" board: three columns of different heights, the headline numbers of an HR day. */
const COLS = [
  { label: "Leave", value: "4", note: "to review", h: "h-[56%]", tone: "bg-[#10113a] text-white", delay: "0s" },
  { label: "Attendance", value: "96%", note: "in today", h: "h-full", tone: "bg-[#3b3bf2] text-white", delay: "0.14s", dot: true },
  { label: "Payroll", value: "Ready", note: "for Friday", h: "h-[74%]", tone: "bg-[#ff6b3d] text-[#10113a]", delay: "0.28s" },
];

export function TodayPodium() {
  return (
    <div role="img" aria-label="Today at a glance: 4 leave requests to review, 96 percent attendance, payroll ready for Friday" className="flex h-[min(52vh,26rem)] items-end gap-3 pt-14">
      {COLS.map((c) => (
        <div key={c.label} style={{ animationDelay: c.delay }} className={`podium-col relative flex flex-col justify-end rounded-t-[1.6rem] p-4 ${c.h} ${c.tone} flex-1`}>
          {c.dot && <span style={{ animationDelay: "1s" }} className="podium-dot absolute -top-14 left-1/2 h-11 w-11 -translate-x-1/2 rounded-full bg-[#10113a]" />}
          <span className="text-sm font-semibold ">{c.label}</span>
          <span className="font-heading text-[clamp(1.8rem,3.4vw,3rem)] font-bold leading-none tracking-[-0.05em]">{c.value}</span>
          <span className="text-sm font-medium ">{c.note}</span>
        </div>
      ))}
    </div>
  );
}

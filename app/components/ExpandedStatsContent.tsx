function YearHeatmapPlaceholder() {
  const rows = 7;
  const cols = 52;
  const accent = new Set([3, 9, 15, 22, 31, 47, 80, 110, 145, 200, 240, 290, 320]);
  return (
    <div className="flex flex-col gap-[3px]">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-[3px]">
          {Array.from({ length: cols }).map((_, c) => {
            const idx = c * rows + r;
            const on = accent.has(idx);
            return (
              <div
                key={c}
                className="size-[5px] rounded-[1px]"
                style={{ backgroundColor: on ? "#545b7f" : "#cec1bf" }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeeklyBarChartPlaceholder() {
  const days = [
    { label: "Sun", value: 0.05 },
    { label: "Mon", value: 0.5 },
    { label: "Tue", value: 0.08 },
    { label: "Wed", value: 0.12 },
    { label: "Thu", value: 0.05 },
    { label: "Fri", value: 0.85 },
    { label: "Sat", value: 1 },
  ];
  return (
    <div className="w-full">
      <div className="relative h-[120px] w-full">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <div
            key={p}
            className="absolute left-0 right-0 border-t border-dotted border-[#8f92a9]/40"
            style={{ bottom: `${p * 100}%` }}
          />
        ))}
        <div className="absolute inset-0 flex items-end justify-between gap-[6px] px-[2px]">
          {days.map((d) => (
            <div
              key={d.label}
              className="flex-1 bg-[#545b7f] rounded-[3px]"
              style={{ height: `${d.value * 100}%` }}
            />
          ))}
        </div>
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M 0,95 C 8,85 12,55 17,55 C 22,55 26,90 30,90 C 35,90 40,80 45,82 C 50,84 55,92 60,92 C 65,92 70,30 75,18 C 80,8 88,2 100,2"
            stroke="#c65c5c"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
      <div className="flex items-start justify-between mt-1 px-[2px]">
        {days.map((d) => (
          <span
            key={d.label}
            className="text-[11px] text-[#8f92a9] tracking-[-0.5px] flex-1 text-center"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ExpandedStatsContent() {
  return (
    <div className="px-[18px] pb-[24px] flex flex-col gap-[20px]">
      <div className="flex flex-col gap-[8px]">
        <p className="text-[#8f92a9] text-[14px] tracking-[-0.84px]">Year Grids</p>
        <YearHeatmapPlaceholder />
      </div>

      <WeeklyBarChartPlaceholder />

      <div className="flex flex-col gap-[6px]">
        <p className="text-[#8f92a9] text-[14px] tracking-[-0.84px]">
          Daily Average
        </p>
        <div className="flex gap-px items-end text-[#545b7f] whitespace-nowrap leading-none">
          <span className="text-[37px] tracking-[-1.85px]">1</span>
          <span className="text-[14px] tracking-[-0.7px]">h</span>
          <span className="text-[37px] tracking-[-1.85px]">12</span>
          <span className="text-[14px] tracking-[-0.7px]">m</span>
        </div>
      </div>
    </div>
  );
}

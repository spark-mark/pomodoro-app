export interface StatBoxProps {
  title: string;
  value: number;
  format?: "number" | "time";
}

export default function StatBox(props: StatBoxProps) {
  const { title, value, format = "number" } = props;

  return (
    <div className="flex flex-col gap-[8px] items-start">
      <p className="text-[#8f92a9] text-[14px] tracking-[-0.84px]">{title}</p>
      {format === "time" ? (
        <div className="flex gap-[3px] items-baseline text-[#545b7f] whitespace-nowrap leading-none">
          <span className="text-[30px] tracking-[-1.5px]">
            {Math.floor(value / 60)}
          </span>
          <span className="text-[13px] tracking-[-0.65px]">h</span>
          <span className="text-[30px] tracking-[-1.5px]">{value % 60}</span>
          <span className="text-[13px] tracking-[-0.65px]">m</span>
        </div>
      ) : (
        <p className="text-[#545b7f] text-[30px] tracking-[-1.5px] leading-none">
          {value}
        </p>
      )}
    </div>
  );
}

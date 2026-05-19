export interface StatBoxProps {
  title: string;
  value: number;
  format?: "number" | "time";
}

export default function StatBox(props: StatBoxProps) {
  const { title, value, format = "number" } = props;

  return (
    <div className="flex flex-col gap-[var(--space-sm)] items-start">
      <p className="text-[var(--color-text-secondary)] text-[var(--text-body)] tracking-[var(--tracking-title)]">{title}</p>
      {format === "time" ? (
        <div className="flex gap-[3px] items-baseline text-[var(--color-text-primary)] whitespace-nowrap leading-none">
          <span className="text-[var(--text-display)] tracking-[var(--tracking-display)]">
            {Math.floor(value / 60)}
          </span>
          <span className="text-[var(--text-body)] tracking-[-0.65px]">h</span>
          <span className="text-[var(--text-display)] tracking-[var(--tracking-display)]">{value % 60}</span>
          <span className="text-[var(--text-body)] tracking-[-0.65px]">m</span>
        </div>
      ) : (
        <p className="text-[var(--color-text-primary)] text-[var(--text-display)] tracking-[var(--tracking-display)] leading-none">
          {value}
        </p>
      )}
    </div>
  );
}

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "primary" | "accent" | "success" | "neutral";
}

const TONE_BG: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  neutral: "bg-surface-elevated text-text-muted",
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg md:h-9 md:w-9",
              TONE_BG[tone],
            )}
          >
            <Icon className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.2} />
          </span>
        ) : null}
      </div>
      <div className="mt-3 truncate text-2xl font-bold text-text md:text-3xl">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 line-clamp-2 text-xs text-text-dim">{hint}</div>
      ) : null}
    </div>
  );
}

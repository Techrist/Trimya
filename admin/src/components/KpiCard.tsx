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
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
        {Icon ? (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              TONE_BG[tone],
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-3xl font-bold text-text">{value}</div>
      {hint ? <div className="mt-1 text-xs text-text-dim">{hint}</div> : null}
    </div>
  );
}

"use client";

import { type Period, PERIOD_LABELS } from "@/lib/types";
import { cn } from "@/lib/cn";

interface PeriodFilterProps {
  value: Period;
  onChange: (p: Period) => void;
  options?: Period[];
}

const DEFAULT_OPTIONS: Period[] = ["today", "7d", "30d", "90d", "all"];

export function PeriodFilter({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
}: PeriodFilterProps) {
  return (
    <div
      role="tablist"
      className="inline-flex rounded-lg border border-border bg-surface p-1"
    >
      {options.map((p) => (
        <button
          key={p}
          type="button"
          role="tab"
          aria-selected={value === p}
          onClick={() => onChange(p)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            value === p
              ? "bg-primary text-black"
              : "text-text-muted hover:text-text",
          )}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

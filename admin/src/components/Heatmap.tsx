"use client";

import { cn } from "@/lib/cn";

/**
 * 7 rows (day of week, Monday first) × 24 columns (hour of day) heatmap.
 * Values are absolute counts; colour intensity is proportional to the max.
 */
interface HeatmapProps {
  /** matrix[dayOfWeek][hour] = count. dayOfWeek 0=Mon..6=Sun */
  matrix: number[][];
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function Heatmap({ matrix }: HeatmapProps) {
  const max = Math.max(
    1,
    ...matrix.flatMap((row) => row.map((v) => v)),
  );

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Hour labels */}
        <div className="flex gap-0.5 pl-10 text-[10px] text-text-dim">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="w-5 text-center">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>

        {matrix.map((row, dow) => (
          <div key={dow} className="mt-0.5 flex items-center gap-0.5">
            <div className="w-10 pr-2 text-right text-[10px] font-semibold text-text-muted">
              {DAYS[dow]}
            </div>
            {row.map((count, h) => {
              const intensity = count === 0 ? 0 : 0.15 + (count / max) * 0.85;
              return (
                <div
                  key={h}
                  title={`${DAYS[dow]} ${h}h — ${count} coupe${count > 1 ? "s" : ""}`}
                  className={cn(
                    "h-5 w-5 rounded-sm transition-colors",
                    count === 0 ? "bg-surface-elevated" : "bg-primary",
                  )}
                  style={count > 0 ? { opacity: intensity } : {}}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="mt-3 flex items-center gap-2 pl-10 text-[10px] text-text-dim">
          <span>Moins</span>
          {[0.15, 0.35, 0.55, 0.75, 1].map((o) => (
            <div
              key={o}
              className="h-3 w-3 rounded-sm bg-primary"
              style={{ opacity: o }}
            />
          ))}
          <span>Plus</span>
        </div>
      </div>
    </div>
  );
}

/** Compute a 7×24 matrix from a list of timestamps (ms). */
export function buildHeatmap(timestamps: number[]): number[][] {
  const m = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const t of timestamps) {
    const d = new Date(t);
    // JS getDay() : 0=Sun..6=Sat. We want Monday=0
    const dow = (d.getDay() + 6) % 7;
    m[dow]![d.getHours()] = (m[dow]![d.getHours()] ?? 0) + 1;
  }
  return m;
}

import { Crown, Sparkles, Leaf } from "lucide-react";
import {
  PLANS,
  effectivePlan,
  isTrialActive,
  type SalonPlanId,
} from "@/lib/plans";
import { cn } from "@/lib/cn";

interface PlanBadgeProps {
  salon: {
    plan?: SalonPlanId;
    planExpiresAt?: number;
    trialEndsAt?: number;
  };
  size?: "sm" | "md";
  showTrial?: boolean;
}

const ICONS: Record<SalonPlanId, typeof Crown> = {
  free: Leaf,
  standard: Sparkles,
  pro: Crown,
};

const STYLES: Record<SalonPlanId, string> = {
  free: "bg-surface-elevated text-text-muted border-border",
  standard: "bg-primary/10 text-primary border-primary/30",
  pro: "bg-accent/10 text-accent border-accent/30",
};

export function PlanBadge({ salon, size = "sm", showTrial = true }: PlanBadgeProps) {
  const effective = effectivePlan(salon);
  const trial = showTrial && isTrialActive(salon);
  const Icon = ICONS[effective];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        STYLES[effective],
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <Icon
        className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"}
        strokeWidth={2.4}
      />
      {PLANS[effective].shortLabel}
      {trial ? <span className="opacity-70">· essai</span> : null}
    </span>
  );
}

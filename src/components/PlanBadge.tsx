import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown, Sparkles, Leaf } from 'lucide-react-native';
import { PLANS, effectivePlan, isTrialActive, type SalonPlanId } from '@/lib/plans';
import { colors, radius, spacing, typography } from '@/theme';
import { useT } from '@/i18n';

interface PlanBadgeProps {
  salon: { plan?: SalonPlanId; planExpiresAt?: number; trialEndsAt?: number };
  size?: 'sm' | 'md';
  showTrial?: boolean;
}

const TONE: Record<SalonPlanId, { bg: string; fg: string; border: string }> = {
  free: {
    bg: colors.surfaceElevated,
    fg: colors.textMuted,
    border: colors.border,
  },
  standard: {
    bg: 'rgba(255, 87, 34, 0.12)',
    fg: colors.primary,
    border: 'rgba(255, 87, 34, 0.35)',
  },
  pro: {
    bg: 'rgba(255, 235, 59, 0.12)',
    fg: colors.accent,
    border: 'rgba(255, 235, 59, 0.4)',
  },
};

export function PlanBadge({
  salon,
  size = 'sm',
  showTrial = true,
}: PlanBadgeProps) {
  const { t } = useT();
  const effective = effectivePlan(salon);
  const trial = showTrial && isTrialActive(salon);
  const tone = TONE[effective];
  const Icon = effective === 'pro' ? Crown : effective === 'standard' ? Sparkles : Leaf;
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
          paddingHorizontal: size === 'sm' ? 8 : 10,
          paddingVertical: size === 'sm' ? 2 : 4,
        },
      ]}
    >
      <Icon color={tone.fg} size={iconSize} strokeWidth={2.4} />
      <Text
        style={[
          styles.label,
          { color: tone.fg, fontSize: size === 'sm' ? 10 : 12 },
        ]}
      >
        {t(`plan.short.${effective}` as never)}
        {trial ? ` · ${t('plan.trialBadge')}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill ?? 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

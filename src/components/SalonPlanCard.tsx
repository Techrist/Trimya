import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Crown, Sparkles, Leaf, ChevronRight } from 'lucide-react-native';
import { Card } from './Card';
import { Button } from './Button';
import { UpgradeModal } from './UpgradeModal';
import { useSalonPlan } from '@/hooks/useSalonPlan';
import {
  PLANS,
  formatPlanPrice,
  getPlanLabel,
  getPlanBullets,
  type SalonPlanId,
} from '@/lib/plans';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

const ICONS: Record<SalonPlanId, React.ComponentType<any>> = {
  free: Leaf,
  standard: Sparkles,
  pro: Crown,
};

interface SalonPlanCardProps {
  salonId: string | null;
}

export function SalonPlanCard({ salonId }: SalonPlanCardProps) {
  const { t } = useT();
  const { plan, trial, trialDays, expiresIn, salon } = useSalonPlan(salonId);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<Exclude<SalonPlanId, 'free'>>(
    'standard',
  );

  // Plan brut côté Firestore — pour décider quel upgrade proposer.
  const rawPlan = salon?.plan ?? 'free';
  const def = PLANS[plan];
  const Icon = ICONS[plan];

  const openUpgrade = (target: Exclude<SalonPlanId, 'free'>) => {
    setUpgradeTarget(target);
    setShowUpgrade(true);
  };

  let subline = '';
  if (trial) {
    subline = t('plan.profile.trialActiveWithDays', { days: trialDays });
  } else if (rawPlan === 'free' || plan === 'free') {
    subline = t('plan.profile.freeDescription');
  } else if (expiresIn !== null && expiresIn > 0) {
    const plural = expiresIn > 1 ? 's' : '';
    subline = t('plan.profile.expiresIn', { days: expiresIn, plural });
  } else {
    subline = t('plan.profile.noExpiry');
  }

  return (
    <>
      <Card style={styles.card} elevated>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor:
                  plan === 'pro'
                    ? 'rgba(255, 235, 59, 0.12)'
                    : plan === 'standard'
                      ? 'rgba(255, 87, 34, 0.12)'
                      : colors.surfaceElevated,
              },
            ]}
          >
            <Icon color={def.accent} size={24} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('plan.profile.currentLabel')}</Text>
            <Text style={styles.planName}>{getPlanLabel(plan, t)}</Text>
            <Text style={styles.subline}>{subline}</Text>
          </View>
        </View>

        {plan !== 'pro' ? (
          <View style={styles.actions}>
            {plan === 'free' ? (
              <>
                <Button
                  label={t('plan.locked.cta', { plan: getPlanLabel('standard', t) })}
                  onPress={() => openUpgrade('standard')}
                  variant="secondary"
                />
                <View style={{ height: spacing.sm }} />
                <Button
                  label={t('plan.locked.cta', { plan: getPlanLabel('pro', t) })}
                  onPress={() => openUpgrade('pro')}
                />
              </>
            ) : (
              <Button
                label={t('plan.locked.cta', { plan: getPlanLabel('pro', t) })}
                onPress={() => openUpgrade('pro')}
              />
            )}
          </View>
        ) : expiresIn !== null && expiresIn <= 14 && expiresIn > 0 ? (
          <View style={styles.actions}>
            <Button
              label={t('plan.profile.renewCta')}
              onPress={() => openUpgrade('pro')}
              variant="secondary"
            />
          </View>
        ) : null}

        <View style={styles.bullets}>
          {getPlanBullets(plan, t).slice(0, 3).map((b) => (
            <View key={b} style={styles.bullet}>
              <Text style={styles.bulletDot}>·</Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      </Card>

      <UpgradeModal
        visible={showUpgrade}
        targetPlan={upgradeTarget}
        onClose={() => setShowUpgrade(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  planName: {
    ...typography.h3,
    color: colors.text,
    marginTop: 2,
  },
  subline: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  actions: {
    marginBottom: spacing.md,
  },
  bullets: {
    gap: spacing.xs,
  },
  bullet: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  bulletDot: {
    color: colors.primary,
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    ...typography.caption,
    color: colors.textMuted,
  },
});

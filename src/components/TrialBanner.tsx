import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Crown, ChevronRight } from 'lucide-react-native';
import { UpgradeModal } from './UpgradeModal';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

interface TrialBannerProps {
  daysLeft: number;
}

/**
 * Bandeau jaune compact affiché en haut des tabs salon pendant l'essai
 * Pro gratuit. Compte les jours restants et ouvre la modal d'upgrade.
 */
export function TrialBanner({ daysLeft }: TrialBannerProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const plural = daysLeft > 1 ? 's' : '';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.banner,
          pressed ? styles.bannerPressed : null,
        ]}
      >
        <View style={styles.left}>
          <Crown color={colors.black} size={16} strokeWidth={2.4} />
          <Text style={styles.text}>
            {t('plan.trial.banner', { days: daysLeft, plural })}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.cta}>{t('plan.trial.bannerCta')}</Text>
          <ChevronRight color={colors.black} size={16} strokeWidth={2.4} />
        </View>
      </Pressable>

      <UpgradeModal
        visible={open}
        targetPlan="pro"
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  bannerPressed: {
    opacity: 0.85,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  text: {
    ...typography.bodyBold,
    color: colors.black,
    flexShrink: 1,
  },
  cta: {
    ...typography.caption,
    color: colors.black,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

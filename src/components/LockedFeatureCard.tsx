import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Lock } from 'lucide-react-native';
import { UpgradeModal } from './UpgradeModal';
import { PLANS, getPlanLabel, type SalonPlanId } from '@/lib/plans';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

interface LockedFeatureCardProps {
  /** Plan minimum requis pour débloquer la fonctionnalité. */
  requiredPlan: Exclude<SalonPlanId, 'free'>;
  /** Titre custom (sinon "Fonction non incluse"). */
  title?: string;
  /** Description custom (sinon la phrase générique). */
  body?: string;
}

/**
 * Variante "carte inline" du LockedFeature plein écran.
 * À utiliser à l'intérieur d'une page (sections gated dans Profile,
 * fiche client, etc.) plutôt qu'à la place d'un tab complet.
 *
 * Cliquable → ouvre la même UpgradeModal que les autres CTA d'upgrade.
 */
export function LockedFeatureCard({
  requiredPlan,
  title,
  body,
}: LockedFeatureCardProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const def = PLANS[requiredPlan];

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.card}>
        <View style={styles.iconWrap}>
          <Lock color={colors.textMuted} size={20} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {title ?? t('plan.locked.title')}
          </Text>
          <Text style={styles.body}>
            {body ?? t('plan.locked.body', { plan: getPlanLabel(requiredPlan, t) })}
          </Text>
          <Text style={[styles.cta, { color: def.accent }]}>
            {t('plan.locked.cta', { plan: getPlanLabel(requiredPlan, t) })}
          </Text>
        </View>
      </Pressable>

      <UpgradeModal
        visible={open}
        targetPlan={requiredPlan}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
  },
  body: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  cta: {
    ...typography.caption,
    fontWeight: '800',
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});

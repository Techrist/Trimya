import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock, Crown, Sparkles } from 'lucide-react-native';
import { Screen } from './Screen';
import { Button } from './Button';
import { UpgradeModal } from './UpgradeModal';
import {
  PLANS,
  getPlanLabel,
  getPlanTagline,
  type SalonPlanId,
} from '@/lib/plans';
import { colors, radius, spacing, typography } from '@/theme';
import { useT } from '@/i18n';

interface LockedFeatureProps {
  /** Plan minimum requis pour débloquer la fonctionnalité. */
  requiredPlan: Exclude<SalonPlanId, 'free'>;
  /** Titre custom (sinon "Fonction non incluse"). */
  title?: string;
  /** Description custom (sinon la phrase générique). */
  body?: string;
}

/**
 * Pleine page de remplacement quand une fonctionnalité n'est pas
 * incluse dans le plan effectif du salon. Affichée à la place du
 * contenu réel pour les tabs Réservations / Messagerie en plan Free.
 */
export function LockedFeature({
  requiredPlan,
  title,
  body,
}: LockedFeatureProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const def = PLANS[requiredPlan];
  const Icon = requiredPlan === 'pro' ? Crown : Sparkles;

  return (
    <Screen padded centered>
      <View style={styles.lockWrap}>
        <Lock color={colors.textMuted} size={42} strokeWidth={2} />
      </View>

      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor:
              requiredPlan === 'pro'
                ? 'rgba(255, 235, 59, 0.12)'
                : 'rgba(255, 87, 34, 0.12)',
          },
        ]}
      >
        <Icon color={def.accent} size={28} strokeWidth={2.2} />
      </View>

      <Text style={styles.title}>{title ?? t('plan.locked.title')}</Text>

      <Text style={styles.body}>
        {body ?? t('plan.locked.body', { plan: getPlanLabel(requiredPlan, t) })}
      </Text>

      <Text style={styles.tagline}>{getPlanTagline(requiredPlan, t)}</Text>

      <View style={{ width: '100%', maxWidth: 320, marginTop: spacing.xl }}>
        <Button
          label={t('plan.locked.cta', { plan: getPlanLabel(requiredPlan, t) })}
          onPress={() => setOpen(true)}
        />
      </View>

      <UpgradeModal
        visible={open}
        targetPlan={requiredPlan}
        onClose={() => setOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lockWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  tagline: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});

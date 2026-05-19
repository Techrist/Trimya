import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
} from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '@/theme';
import { useT } from '@/i18n';
import { Customer, Salon } from '@/types';
import { formatExpiry, daysRemaining } from '@/services/subscriptions';

interface Props {
  visible: boolean;
  customer: Customer | null;
  salon: Salon | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (amount: number) => void;
}

/**
 * Modale d'activation/prolongation d'abonnement coupes illimitées.
 *
 * Pré-remplit le montant avec `salon.subscriptionPrice` mais permet au salon
 * de l'ajuster ponctuellement (cas où le client négocie ou paie un autre tarif).
 *
 * Affiche un récapitulatif clair :
 *  - Si l'abonnement est déjà actif → "Prolongation, expire le X au lieu du Y"
 *  - Sinon → "Nouvel abonnement, expire le X"
 */
export function SubscriptionActivationSheet({
  visible,
  customer,
  salon,
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useT();
  const defaultPrice = salon?.subscriptionPrice ?? 0;
  const currency = salon?.currency || 'FCFA';
  const [amountStr, setAmountStr] = useState(String(defaultPrice || ''));

  // Quand la modale s'ouvre, on resync le montant sur le prix configuré.
  useEffect(() => {
    if (visible) {
      setAmountStr(defaultPrice > 0 ? String(defaultPrice) : '');
    }
  }, [visible, defaultPrice]);

  if (!customer) return null;

  const isActive = !!(
    customer.subscriptionExpiresAt && customer.subscriptionExpiresAt > Date.now()
  );
  const currentExpiry = customer.subscriptionExpiresAt || 0;
  const projectedStart = isActive ? currentExpiry : Date.now();
  const projectedExpiry = projectedStart + 30 * 24 * 60 * 60 * 1000;

  const handleConfirm = () => {
    const parsed = parseInt(amountStr.replace(/\s/g, ''), 10);
    onConfirm(isNaN(parsed) ? 0 : parsed);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Pressable style={styles.closeBtn} onPress={onCancel} hitSlop={12}>
            <X color={colors.textMuted} size={22} strokeWidth={2.2} />
          </Pressable>

          <View style={styles.iconWrap}>
            <Sparkles color={colors.primary} size={36} strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>
            {isActive
              ? t('subscription.activation.titleExtend')
              : t('subscription.activation.titleNew')}
          </Text>
          <Text style={styles.subtitle}>
            {customer.name?.trim() || customer.phone}
          </Text>

          {isActive ? (
            <View style={styles.currentCard}>
              <Text style={styles.currentLabel}>
                {t('subscription.activation.currentExpiry')}
              </Text>
              <Text style={styles.currentValue}>
                {formatExpiry(currentExpiry)}
              </Text>
              <Text style={styles.currentDays}>
                {t(
                  daysRemaining(customer) > 1
                    ? 'subscription.daysLeftPlural'
                    : 'subscription.daysLeft',
                  { count: daysRemaining(customer) },
                )}
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>
            {t('subscription.activation.amountLabel')}
          </Text>
          <View style={styles.amountRow}>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textDim}
              style={styles.amountInput}
            />
            <Text style={styles.currency}>{currency}</Text>
          </View>

          <View style={styles.projectionCard}>
            <Text style={styles.projectionLabel}>
              {isActive
                ? t('subscription.activation.newExpiryAfterExtend')
                : t('subscription.activation.newExpiry')}
            </Text>
            <Text style={styles.projectionValue}>
              {formatExpiry(projectedExpiry)}
            </Text>
            <Text style={styles.projectionHint}>
              {t('subscription.activation.duration')}
            </Text>
          </View>

          <View style={{ height: spacing.lg }} />

          <Button
            label={
              isActive
                ? t('subscription.activation.extendCta')
                : t('subscription.activation.activateCta')
            }
            onPress={handleConfirm}
            loading={loading}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            label={t('common.cancel')}
            variant="ghost"
            onPress={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  currentCard: {
    backgroundColor: 'rgba(255, 235, 59, 0.10)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  currentLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  currentValue: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xs,
  },
  currentDays: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  amountInput: {
    flex: 1,
    ...typography.h2,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  currency: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  projectionCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  projectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  projectionValue: {
    ...typography.h2,
    color: colors.success,
    marginTop: spacing.xs,
  },
  projectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});

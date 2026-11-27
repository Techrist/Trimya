import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Linking,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  Crown,
  Sparkles,
  Check,
  X,
  Smartphone,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import { Button } from './Button';
import { TextField } from './TextField';
import {
  PLANS,
  getPlanLabel,
  getPlanTagline,
  getPlanBullets,
  planPriceFor,
  type BillingPeriod,
  type PlanId,
} from '@/lib/plans';
import {
  getPaymentStatus,
  getQuote,
  startPayment,
  type BillingNetwork,
  type BillingQuote,
  type BillingTargetType,
} from '@/services/billing';
import { useApp } from '@/contexts/AppContext';
import { colors, radius, spacing, typography } from '@/theme';
import { useT } from '@/i18n';

/** Aide humaine : le paiement automatique reste le parcours principal. */
const CONTACT_WHATSAPP = '+237692979345';

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_MS = 3 * 60 * 1000;

type Step = 'form' | 'pending' | 'success' | 'failed' | 'review' | 'timeout';

interface UpgradeModalProps {
  visible: boolean;
  targetPlan: Exclude<PlanId, 'free'>;
  onClose: () => void;
  /** 'salon' par défaut (kiosque) ; 'owner' pour les plans Entreprise. */
  targetType?: BillingTargetType;
}

const fcfa = (n: number) =>
  `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;

export function UpgradeModal({
  visible,
  targetPlan,
  onClose,
  targetType = 'salon',
}: UpgradeModalProps) {
  const { t, locale } = useT();
  const { salonId, ownerId } = useApp();
  const targetId = targetType === 'owner' ? ownerId : salonId;

  const def = PLANS[targetPlan];
  const Icon = targetPlan === 'pro' || targetPlan === 'enterprise' ? Crown : Sparkles;

  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [network, setNetwork] = useState<BillingNetwork>('mtn_cm');
  const [phone, setPhone] = useState('');
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // Remise à zéro à chaque ouverture.
  useEffect(() => {
    if (visible) {
      setStep('form');
      setFormError(null);
      setSubmitting(false);
    } else {
      stopPolling();
    }
  }, [visible, stopPolling]);

  const errText = useCallback(
    (e: unknown): string => {
      const code = e instanceof Error ? e.message : '';
      const key = `billing.error.${code}`;
      const msg = t(key as never);
      return msg === key ? t('billing.error.generic') : msg;
    },
    [t],
  );

  // Devis serveur (prix réel, crédit d'upgrade) à chaque changement.
  useEffect(() => {
    if (!visible || !targetId || step !== 'form') return;
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);
    getQuote({ targetType, targetId, planId: targetPlan, period })
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch((e) => {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(errText(e));
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, targetId, targetType, targetPlan, period, step, errText]);

  const poll = useCallback(
    (paymentId: string, startedAt: number) => {
      pollTimer.current = setTimeout(async () => {
        if (!alive.current) return;
        try {
          const s = await getPaymentStatus(paymentId);
          if (!alive.current) return;
          if (s.status === 'SUCCESS') {
            setExpiresAt(s.expiresAt);
            setStep('success');
            return;
          }
          if (s.status === 'FAILED') return setStep('failed');
          if (s.status === 'REVIEW') return setStep('review');
        } catch {
          // Erreur réseau ponctuelle : on continue d'interroger.
        }
        if (Date.now() - startedAt > POLL_MAX_MS) return setStep('timeout');
        poll(paymentId, startedAt);
      }, POLL_INTERVAL_MS);
    },
    [],
  );

  const handlePay = async () => {
    if (!targetId || !quote) return;
    if (phone.replace(/\D/g, '').length < 8) {
      setFormError(t('billing.error.invalid_phone'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const r = await startPayment(
        { targetType, targetId, planId: targetPlan, period },
        { network, phone },
      );
      // checkout_url non vide → sans cette redirection, aucun paiement n'a lieu.
      if (r.checkoutUrl) Linking.openURL(r.checkoutUrl).catch(() => {});
      setStep('pending');
      poll(r.paymentId, Date.now());
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setSubmitting(false);
    }
  };

  const openHelp = () =>
    Linking.openURL(
      `whatsapp://send?phone=${encodeURIComponent(
        CONTACT_WHATSAPP.replace(/\s/g, ''),
      )}&text=${encodeURIComponent(
        t('plan.upgrade.whatsappMessage', { plan: getPlanLabel(targetPlan, t) }),
      )}`,
    ).catch(() =>
      Linking.openURL(`https://wa.me/${CONTACT_WHATSAPP.replace(/[^0-9]/g, '')}`),
    );

  const yearlyPrice = planPriceFor(targetPlan, 'yearly');
  const monthlyPrice = planPriceFor(targetPlan, 'monthly');

  const renderBody = () => {
    if (step === 'pending') {
      return (
        <View style={styles.centerBlock}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.stateTitle}>{t('billing.pending.title')}</Text>
          <Text style={styles.stateText}>
            {t('billing.pending.text', { phone })}
          </Text>
        </View>
      );
    }
    if (step === 'success') {
      const date = new Date(expiresAt).toLocaleDateString(
        locale === 'en' ? 'en-GB' : 'fr-FR',
        { day: 'numeric', month: 'long', year: 'numeric' },
      );
      return (
        <View style={styles.centerBlock}>
          <CheckCircle2 color={colors.success} size={56} strokeWidth={2} />
          <Text style={styles.stateTitle}>{t('billing.success.title')}</Text>
          <Text style={styles.stateText}>
            {t('billing.success.text', { plan: getPlanLabel(targetPlan, t), date })}
          </Text>
          <View style={{ height: spacing.lg }} />
          <Button label={t('plan.upgrade.close')} onPress={onClose} fullWidth />
        </View>
      );
    }
    if (step === 'failed' || step === 'review' || step === 'timeout') {
      const text =
        step === 'failed'
          ? t('billing.failed.text')
          : step === 'review'
            ? t('billing.review.text')
            : t('billing.timeout');
      return (
        <View style={styles.centerBlock}>
          <XCircle
            color={step === 'timeout' ? colors.textMuted : colors.danger}
            size={56}
            strokeWidth={2}
          />
          <Text style={styles.stateTitle}>{t('billing.failed.title')}</Text>
          <Text style={styles.stateText}>{text}</Text>
          <View style={{ height: spacing.lg }} />
          {step === 'failed' ? (
            <Button
              label={t('billing.retry')}
              onPress={() => setStep('form')}
              fullWidth
            />
          ) : (
            <Button label={t('plan.upgrade.close')} onPress={onClose} fullWidth />
          )}
          <View style={{ height: spacing.sm }} />
          <Button label={t('billing.help')} onPress={openHelp} variant="ghost" />
        </View>
      );
    }

    // ── Formulaire ──
    return (
      <>
        <View style={styles.periodRow}>
          {(['monthly', 'yearly'] as BillingPeriod[]).map((p) => {
            const active = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.periodCard, active && styles.periodCardActive]}
              >
                {p === 'yearly' ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {t('billing.period.yearlyBadge')}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.periodLabel}>
                  {t(p === 'yearly' ? 'billing.period.yearly' : 'billing.period.monthly')}
                </Text>
                <Text style={styles.periodPrice}>
                  {fcfa(p === 'yearly' ? yearlyPrice : monthlyPrice)}
                </Text>
                <Text style={styles.periodSuffix}>
                  {t(
                    p === 'yearly'
                      ? 'billing.period.yearlySuffix'
                      : 'billing.period.monthlySuffix',
                  )}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>{t('billing.network.label')}</Text>
        <View style={styles.networkRow}>
          {(
            [
              ['mtn_cm', 'billing.network.mtn'],
              ['orange_cm', 'billing.network.orange'],
            ] as [BillingNetwork, string][]
          ).map(([code, key]) => {
            const active = network === code;
            return (
              <Pressable
                key={code}
                onPress={() => setNetwork(code)}
                style={[styles.networkBtn, active && styles.networkBtnActive]}
              >
                <Smartphone
                  color={active ? colors.primary : colors.textMuted}
                  size={18}
                  strokeWidth={2.2}
                />
                <Text
                  style={[styles.networkText, active && { color: colors.text }]}
                >
                  {t(key as never)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label={t('billing.phone.label')}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('billing.phone.placeholder')}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={20}
        />

        <View style={styles.priceCard}>
          {quoteLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : quote ? (
            <>
              {quote.kind !== 'new' ? (
                <Text style={styles.kindText}>
                  {t(
                    quote.kind === 'renew'
                      ? 'billing.kind.renew'
                      : 'billing.kind.upgrade',
                  )}
                </Text>
              ) : null}
              {quote.credit > 0 ? (
                <Text style={styles.creditText}>
                  {t('billing.credit', { amount: fcfa(quote.credit) })}
                </Text>
              ) : null}
              {quote.promoPercent && quote.promoEndsAt ? (
                <Text style={styles.promoText}>
                  {t('billing.promo', {
                    percent: quote.promoPercent,
                    date: new Date(quote.promoEndsAt).toLocaleDateString(locale),
                  })}
                </Text>
              ) : null}
              <Text style={styles.priceLabel}>{t('billing.total')}</Text>
              {quote.promoPercent && quote.promoDiscount ? (
                <Text style={styles.oldPrice}>{fcfa(quote.listPrice)}</Text>
              ) : null}
              <Text style={styles.price}>{fcfa(quote.amount)}</Text>
              <Text style={styles.feesNote}>{t('billing.feesNote')}</Text>
            </>
          ) : (
            <Text style={styles.errorText}>{quoteError ?? ''}</Text>
          )}
        </View>

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

        <Button
          label={t('billing.payCta', { amount: quote ? fcfa(quote.amount) : '' })}
          onPress={handlePay}
          loading={submitting}
          disabled={!quote || submitting || !targetId}
          fullWidth
        />
        <View style={{ height: spacing.sm }} />
        <Button label={t('billing.help')} onPress={openHelp} variant="ghost" />
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <X color={colors.textMuted} size={22} strokeWidth={2.2} />
            </Pressable>

            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor:
                    targetPlan === 'pro' || targetPlan === 'enterprise'
                      ? 'rgba(255, 235, 59, 0.12)'
                      : 'rgba(255, 87, 34, 0.12)',
                },
              ]}
            >
              <Icon color={def.accent} size={40} strokeWidth={2.2} />
            </View>

            <Text style={styles.title}>
              {t('plan.upgrade.title', { plan: getPlanLabel(targetPlan, t) })}
            </Text>
            <Text style={styles.tagline}>{getPlanTagline(targetPlan, t)}</Text>

            {step === 'form' ? (
              <View style={styles.bullets}>
                {getPlanBullets(targetPlan, t).map((b) => (
                  <View key={b} style={styles.bullet}>
                    <Check color={def.accent} size={18} strokeWidth={2.4} />
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {renderBody()}
          </ScrollView>
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
    maxHeight: '94%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
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
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  bullets: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  periodCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  periodCardActive: {
    borderColor: colors.primary,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    color: colors.black,
    fontWeight: '700',
  },
  periodLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  periodPrice: {
    ...typography.h3,
    color: colors.text,
    marginTop: 2,
  },
  periodSuffix: {
    ...typography.caption,
    color: colors.textDim,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  networkRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  networkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  networkBtnActive: {
    borderColor: colors.primary,
  },
  networkText: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '600',
  },
  priceCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 72,
    justifyContent: 'center',
  },
  priceLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  price: {
    ...typography.h2,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  kindText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  promoText: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  oldPrice: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    textDecorationLine: 'line-through',
  },
  creditText: {
    ...typography.caption,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  feesNote: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  stateTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  stateText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

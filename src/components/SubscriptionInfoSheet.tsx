import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  ScrollView,
} from 'react-native';
import {
  Sparkles,
  X,
  MessageCircle,
  Phone,
  Infinity as InfinityIcon,
} from 'lucide-react-native';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '@/theme';
import { useT } from '@/i18n';
import { Salon } from '@/types';

interface Props {
  visible: boolean;
  salon: Salon | null;
  onClose: () => void;
}

/**
 * Modale d'explication du fonctionnement de l'abonnement coupes illimitées,
 * affichée côté client. Pas d'inscription en-app : tout passe par le salon
 * en physique (paiement offline). Cette modale explique cette mécanique
 * en 3 étapes claires + propose un contact direct du salon.
 */
export function SubscriptionInfoSheet({ visible, salon, onClose }: Props) {
  const { t } = useT();
  const phone = salon?.phone?.replace(/\s/g, '');
  const currency = salon?.currency || 'FCFA';
  const price = salon?.subscriptionPrice || 0;

  const openWhatsApp = () => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const text = encodeURIComponent(t('subscription.info.whatsappText'));
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${text}`).catch(
      () => Linking.openURL(`https://wa.me/${cleanPhone.replace(/\+/g, '')}`),
    );
  };

  const callSalon = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
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
            contentContainerStyle={styles.scroll}
          >
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
              <X color={colors.textMuted} size={22} strokeWidth={2.2} />
            </Pressable>

            <View style={styles.iconWrap}>
              <InfinityIcon color={colors.primary} size={40} strokeWidth={2.4} />
            </View>

            <Text style={styles.title}>{t('subscription.info.title')}</Text>
            <Text style={styles.subtitle}>
              {t('subscription.info.subtitle')}
            </Text>

            {price > 0 ? (
              <View style={styles.priceCard}>
                <Text style={styles.priceLabel}>
                  {t('subscription.info.priceLabel')}
                </Text>
                <Text style={styles.priceValue}>
                  {price.toLocaleString('fr-FR')} {currency}
                </Text>
                <Text style={styles.priceHint}>
                  {t('subscription.info.priceHint')}
                </Text>
              </View>
            ) : null}

            <Text style={styles.howTitle}>
              {t('subscription.info.howTitle')}
            </Text>

            <View style={styles.steps}>
              <Step
                index={1}
                title={t('subscription.info.step1Title')}
                body={t('subscription.info.step1Body')}
              />
              <Step
                index={2}
                title={t('subscription.info.step2Title')}
                body={t('subscription.info.step2Body')}
              />
              <Step
                index={3}
                title={t('subscription.info.step3Title')}
                body={t('subscription.info.step3Body')}
              />
            </View>

            <View style={styles.benefitsCard}>
              <View style={styles.benefitsHeader}>
                <Sparkles color={colors.accent} size={18} strokeWidth={2.4} />
                <Text style={styles.benefitsTitle}>
                  {t('subscription.info.benefitsTitle')}
                </Text>
              </View>
              <Text style={styles.benefit}>
                · {t('subscription.info.benefit1')}
              </Text>
              <Text style={styles.benefit}>
                · {t('subscription.info.benefit2')}
              </Text>
              <Text style={styles.benefit}>
                · {t('subscription.info.benefit3')}
              </Text>
            </View>

            {phone ? (
              <>
                <Text style={styles.contactLabel}>
                  {t('subscription.info.contactLabel', {
                    name: salon?.name || '',
                  })}
                </Text>

                <Button
                  label={t('subscription.info.whatsappCta')}
                  onPress={openWhatsApp}
                />
                <View style={{ height: spacing.sm }} />
                <Pressable onPress={callSalon} style={styles.callBtn}>
                  <Phone color={colors.primary} size={18} strokeWidth={2.2} />
                  <Text style={styles.callBtnText}>
                    {t('subscription.info.callCta')}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.noContactHint}>
                {t('subscription.info.noContact')}
              </Text>
            )}

            <View style={{ height: spacing.md }} />
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={onClose}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Step({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
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
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
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
  priceCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  priceLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  priceValue: {
    ...typography.h1,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  priceHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  howTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.md,
  },
  steps: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: colors.black,
    fontWeight: '800',
    fontSize: 16,
  },
  stepTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  stepBody: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 2,
  },
  benefitsCard: {
    backgroundColor: 'rgba(255, 235, 59, 0.08)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  benefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  benefitsTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  benefit: {
    ...typography.body,
    color: colors.text,
  },
  contactLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.06)',
  },
  callBtnText: {
    ...typography.button,
    color: colors.primary,
  },
  noContactHint: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
});

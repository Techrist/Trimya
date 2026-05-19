import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Linking,
  ScrollView,
  Pressable,
} from 'react-native';
import { Crown, Sparkles, Check, MessageCircle, Mail, X } from 'lucide-react-native';
import { Button } from './Button';
import {
  PLANS,
  formatPlanPrice,
  getPlanLabel,
  getPlanTagline,
  getPlanBullets,
  type SalonPlanId,
} from '@/lib/plans';
import { colors, radius, spacing, typography } from '@/theme';
import { useT } from '@/i18n';

/**
 * Coordonnées commerciales Trimya — utilisées par les boutons d'upgrade.
 */
const CONTACT_WHATSAPP = '+237692979345';
const CONTACT_EMAIL = 'tenimkoc@gmail.com';

interface UpgradeModalProps {
  visible: boolean;
  targetPlan: Exclude<SalonPlanId, 'free'>;
  onClose: () => void;
}

export function UpgradeModal({
  visible,
  targetPlan,
  onClose,
}: UpgradeModalProps) {
  const { t } = useT();
  const def = PLANS[targetPlan];
  const Icon = targetPlan === 'pro' ? Crown : Sparkles;

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
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <X color={colors.textMuted} size={22} strokeWidth={2.2} />
            </Pressable>

            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor:
                    targetPlan === 'pro'
                      ? 'rgba(255, 235, 59, 0.12)'
                      : 'rgba(255, 87, 34, 0.12)',
                },
              ]}
            >
              <Icon
                color={def.accent}
                size={40}
                strokeWidth={2.2}
              />
            </View>

            <Text style={styles.title}>
              {t('plan.upgrade.title', { plan: getPlanLabel(targetPlan, t) })}
            </Text>
            <Text style={styles.tagline}>{getPlanTagline(targetPlan, t)}</Text>

            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>
                {t('plan.upgrade.priceLabel')}
              </Text>
              <Text style={styles.price}>{formatPlanPrice(def)}</Text>
            </View>

            <View style={styles.bullets}>
              {getPlanBullets(targetPlan, t).map((b) => (
                <View key={b} style={styles.bullet}>
                  <Check color={def.accent} size={18} strokeWidth={2.4} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.intro}>{t('plan.upgrade.intro')}</Text>

            <Text style={styles.contactLabel}>
              {t('plan.upgrade.contactLabel')}
            </Text>

            <Button
              label={t('plan.upgrade.contactWhatsapp')}
              onPress={() =>
                Linking.openURL(
                  `whatsapp://send?phone=${encodeURIComponent(
                    CONTACT_WHATSAPP.replace(/\s/g, ''),
                  )}&text=${encodeURIComponent(
                    t('plan.upgrade.whatsappMessage', {
                      plan: getPlanLabel(targetPlan, t),
                    }),
                  )}`,
                ).catch(() =>
                  Linking.openURL(
                    `https://wa.me/${CONTACT_WHATSAPP.replace(/[^0-9]/g, '')}`,
                  ),
                )
              }
            />

            <View style={{ height: spacing.sm }} />

            <Button
              label={t('plan.upgrade.contactEmail')}
              onPress={() =>
                Linking.openURL(
                  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                    t('plan.upgrade.emailSubject', {
                      plan: getPlanLabel(targetPlan, t),
                    }),
                  )}`,
                )
              }
              variant="secondary"
            />

            <View style={{ height: spacing.md }} />

            <Button
              label={t('plan.upgrade.close')}
              onPress={onClose}
              variant="ghost"
            />
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
  price: {
    ...typography.h2,
    color: colors.primary,
    marginTop: spacing.xs,
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
  intro: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  contactLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});

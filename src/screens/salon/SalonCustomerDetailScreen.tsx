import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Star,
  Scissors,
  Gift,
  Send,
  MessageCircle,
  Lock,
  Sparkles,
  MessageSquare,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { subscribeConversation } from '@/services/conversations';
import { Conversation } from '@/types';
import { useT, getCurrentLocale, localeToBcp47 } from '@/i18n';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { UpgradeModal } from '@/components/UpgradeModal';
import { SubscriptionActivationSheet } from '@/components/SubscriptionActivationSheet';
import { LockedFeatureCard } from '@/components/LockedFeatureCard';
import { useApp } from '@/contexts/AppContext';
import { useSalonPlan } from '@/hooks/useSalonPlan';
import {
  subscribeCustomer,
  setCustomerVip,
  setCustomerNotes,
} from '@/services/customers';
import { addCut, subscribeRecentCuts } from '@/services/cuts';
import { getSalon, subscribeSalon } from '@/services/salons';
import {
  activateSubscription,
  cancelSubscription,
  daysRemaining,
  formatExpiry,
} from '@/services/subscriptions';
import { getReviewsForCuts } from '@/services/reviews';
import { colors, radius, spacing, typography, REWARD_THRESHOLD } from '@/theme';
import {
  Customer,
  Cut,
  CutReview,
  Salon,
  isSubscriptionActive,
} from '@/types';
import { CustomersStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<CustomersStackParamList, 'CustomerDetail'>;
type Rt = RouteProp<CustomersStackParamList, 'CustomerDetail'>;

export function SalonCustomerDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { customerId } = route.params;
  const { salonId } = useApp();
  const { t } = useT();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [reviews, setReviews] = useState<Map<string, CutReview>>(new Map());
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [adding, setAdding] = useState(false);
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [subscriptionSheetVisible, setSubscriptionSheetVisible] = useState(false);
  const [subscriptionSubmitting, setSubscriptionSubmitting] = useState(false);
  const { limits } = useSalonPlan(salonId);
  const allowVipNotes = limits.vipAndNotes;

  useEffect(() => {
    const unsubC = subscribeCustomer(customerId, (c) => {
      setCustomer(c);
      if (c) setNotes(c.notes || '');
    });
    const unsubH = subscribeRecentCuts(
      customerId,
      async (list) => {
        setCuts(list);
        // Charge en parallèle les notes correspondantes pour les coupes avec coiffeur.
        const ids = list.filter((c) => c.barberId).map((c) => c.id);
        if (ids.length > 0) {
          const map = await getReviewsForCuts(ids);
          setReviews(map);
        } else {
          setReviews(new Map());
        }
      },
      30,
    );
    // On ne souscrit aux conversations que si le plan le permet, pour éviter
    // des permission-denied côté Firestore (rule planAllows sur conversations).
    const unsubConvo = limits.messaging
      ? subscribeConversation(customerId, setConvo)
      : undefined;
    let unsubSalon: (() => void) | undefined;
    if (salonId) {
      unsubSalon = subscribeSalon(salonId, setSalon);
    }
    return () => {
      unsubC();
      unsubH();
      unsubConvo?.();
      unsubSalon?.();
    };
  }, [customerId, salonId, limits.messaging]);

  const handleActivateSubscription = async (amount: number) => {
    if (!customer || !salon) return;
    setSubscriptionSubmitting(true);
    try {
      const r = await activateSubscription({ customer, salon, amount });
      setSubscriptionSheetVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        r.wasExtension
          ? t('subscription.activation.extendedTitle')
          : t('subscription.activation.activatedTitle'),
        t('subscription.activation.confirmText', {
          name: customer.name?.trim() || customer.phone,
          date: formatExpiry(r.newExpiresAt),
        }),
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSubscriptionSubmitting(false);
    }
  };

  const handleCancelSubscription = () => {
    if (!customer) return;
    Alert.alert(
      t('subscription.cancelConfirmTitle'),
      t('subscription.cancelConfirmText', {
        name: customer.name?.trim() || customer.phone,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('subscription.cancelConfirmCta'),
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSubscription(customer.id);
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
            }
          },
        },
      ],
    );
  };

  const handleAddCut = async () => {
    if (!customer || !salonId) return;
    setAdding(true);
    try {
      const r = await addCut({ customerId: customer.id, salonId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        r.wasReward ? t('salon.customer.rewardOk') : t('salon.customer.addCutOk'),
        `${customer.name || t('salon.reservation.client')} : ${r.newCount}/${REWARD_THRESHOLD}` +
          (r.rewardUnlocked ? t('salon.customer.rewardUnlockedNote') : ''),
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleVip = async () => {
    if (!customer) return;
    if (!allowVipNotes) {
      setShowUpgrade(true);
      return;
    }
    try {
      await setCustomerVip(customer.id, !customer.vip);
      Haptics.selectionAsync();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
  };

  const handleSaveNotes = async () => {
    if (!customer || !allowVipNotes) return;
    setSavingNotes(true);
    try {
      await setCustomerNotes(customer.id, notes);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSavingNotes(false);
    }
  };

  if (!customer) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const created = new Date(customer.createdAt).toLocaleDateString(
    localeToBcp47(getCurrentLocale()),
    { day: '2-digit', month: 'long', year: 'numeric' },
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={cuts}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.topRow}>
              <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
                <ChevronLeft color={colors.textMuted} size={22} strokeWidth={2.2} />
                <Text style={styles.back}>{t('common.back')}</Text>
              </Pressable>
              <Pressable
                onPress={handleToggleVip}
                hitSlop={12}
                style={[
                  styles.vipToggle,
                  customer.vip && allowVipNotes && styles.vipToggleActive,
                ]}
              >
                {allowVipNotes ? (
                  <Star
                    color={customer.vip ? colors.accent : colors.textMuted}
                    size={16}
                    strokeWidth={2.2}
                    fill={customer.vip ? colors.accent : 'transparent'}
                  />
                ) : (
                  <Lock color={colors.textMuted} size={14} strokeWidth={2.2} />
                )}
                <Text
                  style={[
                    styles.vipToggleText,
                    customer.vip && allowVipNotes && styles.vipToggleTextActive,
                  ]}
                >
                  {customer.vip && allowVipNotes
                    ? t('salon.customer.vipBadge')
                    : t('salon.customer.markVip')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.heroRow}>
              <Avatar name={customer.name} photo={customer.photo} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{customer.name || t('salon.customers.row.noName')}</Text>
                <Text style={styles.phone}>{customer.phone}</Text>
                <Text style={styles.since}>{t('salon.customer.clientSince', { date: created })}</Text>
              </View>
            </View>

            <Card style={styles.progressCard} elevated>
              <ProgressIndicator count={customer.currentCount} />
            </Card>

            {limits.subscriptions ? (
              <SubscriptionSection
                customer={customer}
                onActivate={() => setSubscriptionSheetVisible(true)}
                onCancel={handleCancelSubscription}
                t={t}
              />
            ) : isSubscriptionActive(customer) ? (
              // Le salon a downgrade mais le client a encore un abonnement actif
              // → on affiche en lecture seule, sans permettre prolongation.
              <SubscriptionSection
                customer={customer}
                onActivate={() => {}}
                onCancel={handleCancelSubscription}
                t={t}
                readOnly
              />
            ) : (
              <View style={{ marginBottom: spacing.lg }}>
                <LockedFeatureCard
                  requiredPlan="pro"
                  body={t('subscription.lockedBody')}
                />
              </View>
            )}

            <View style={styles.statsRow}>
              <Stat label={t('salon.customer.stat.cuts')} value={customer.totalCuts} />
              <Stat label={t('salon.customer.stat.rewards')} value={customer.totalRewards} />
              <Stat
                label={t('salon.customer.stat.lastVisit')}
                value={
                  customer.lastVisitAt
                    ? new Date(customer.lastVisitAt).toLocaleDateString(
                        localeToBcp47(getCurrentLocale()),
                        { day: '2-digit', month: 'short' },
                      )
                    : '—'
                }
                isText
              />
            </View>

            <Button
              label={
                customer.currentCount >= REWARD_THRESHOLD
                  ? t('salon.customer.validateRewardCta')
                  : t('salon.customer.addCutCta')
              }
              onPress={handleAddCut}
              loading={adding}
            />

            {limits.messaging ? (
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => nav.navigate('Chat', { customerId })}
                  style={[styles.actionBtn, { flex: 1 }]}
                >
                  <MessageCircle color={colors.primary} size={18} strokeWidth={2.2} />
                  <Text style={styles.actionBtnText}>{t('salon.customer.actionConversation')}</Text>
                  {convo && convo.unreadBySalon > 0 && (
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>
                        {convo.unreadBySalon > 9 ? '9+' : convo.unreadBySalon}
                      </Text>
                    </View>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => nav.navigate('ComposeNotification', { customerId })}
                  style={[styles.actionBtn, { flex: 1 }]}
                >
                  <Send color={colors.primary} size={18} strokeWidth={2.2} />
                  <Text style={styles.actionBtnText}>{t('salon.customer.actionNotification')}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ marginVertical: spacing.sm }}>
                <LockedFeatureCard
                  requiredPlan="standard"
                  body={t('salon.customer.messagingLockedBody')}
                />
              </View>
            )}

            <View style={styles.notesSection}>
              <Text style={styles.sectionLabel}>{t('salon.customer.notes.title')}</Text>
              {allowVipNotes ? (
                <>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    onBlur={handleSaveNotes}
                    placeholder={t('salon.customer.notes.placeholder')}
                    placeholderTextColor={colors.textDim}
                    multiline
                    style={styles.notesInput}
                  />
                  {savingNotes && (
                    <Text style={styles.savingHint}>{t('salon.customer.notes.saving')}</Text>
                  )}
                </>
              ) : (
                <Pressable
                  onPress={() => setShowUpgrade(true)}
                  style={styles.notesLockedRow}
                >
                  <Lock color={colors.textMuted} size={16} strokeWidth={2.2} />
                  <Text style={styles.notesLockedText}>
                    {t('plan.locked.body', { plan: 'Standard' })}
                  </Text>
                </Pressable>
              )}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
              {t('salon.customer.history')}
            </Text>
            {cuts.length === 0 && (
              <Text style={styles.emptyHistory}>{t('salon.customer.historyEmpty')}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <HistoryRow cut={item} review={reviews.get(item.id) || null} t={t} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />

      <UpgradeModal
        visible={showUpgrade}
        targetPlan="standard"
        onClose={() => setShowUpgrade(false)}
      />

      <SubscriptionActivationSheet
        visible={subscriptionSheetVisible}
        customer={customer}
        salon={salon}
        loading={subscriptionSubmitting}
        onCancel={() => setSubscriptionSheetVisible(false)}
        onConfirm={handleActivateSubscription}
      />
    </Screen>
  );
}

function SubscriptionSection({
  customer,
  onActivate,
  onCancel,
  t,
  readOnly = false,
}: {
  customer: Customer;
  onActivate: () => void;
  onCancel: () => void;
  t: (key: any, vars?: Record<string, any>) => string;
  /** Mode lecture seule : le salon a perdu le plan Pro mais l'abonnement
   *  reste actif jusqu'à expiration. Plus de bouton "Prolonger". */
  readOnly?: boolean;
}) {
  const active = isSubscriptionActive(customer);
  const days = daysRemaining(customer);

  // Card.style accepte un seul ViewStyle, on aplatit pour éviter le mismatch.
  const cardStyle = {
    ...styles.subscriptionCard,
    ...(active ? styles.subscriptionCardActive : {}),
  };

  return (
    <Card style={cardStyle}>
      <View style={styles.subscriptionHeader}>
        <Sparkles
          color={active ? colors.primary : colors.textMuted}
          size={20}
          strokeWidth={2.2}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.subscriptionTitle}>
            {active
              ? t('subscription.salon.activeTitle')
              : t('subscription.salon.inactiveTitle')}
          </Text>
          {active && customer.subscriptionExpiresAt ? (
            <Text style={styles.subscriptionSubtitle}>
              {t('subscription.salon.expiresOn', {
                date: formatExpiry(customer.subscriptionExpiresAt),
              })}
              {' · '}
              {t(
                days > 1
                  ? 'subscription.daysLeftPlural'
                  : 'subscription.daysLeft',
                { count: days },
              )}
            </Text>
          ) : (
            <Text style={styles.subscriptionSubtitle}>
              {t('subscription.salon.inactiveHint')}
            </Text>
          )}
        </View>
      </View>

      {readOnly ? (
        <Text style={styles.subscriptionReadOnlyHint}>
          {t('subscription.salon.readOnlyHint')}
        </Text>
      ) : (
        <View style={styles.subscriptionActions}>
          <View style={{ flex: 1 }}>
            <Button
              label={
                active
                  ? t('subscription.salon.extendCta')
                  : t('subscription.salon.activateCta')
              }
              onPress={onActivate}
              variant={active ? 'secondary' : 'primary'}
            />
          </View>
          {active ? (
            <Pressable onPress={onCancel} style={styles.subscriptionCancelBtn}>
              <Text style={styles.subscriptionCancelText}>
                {t('subscription.salon.cancelCta')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Card>
  );
}

function Stat({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <Card style={styles.stat}>
      <Text style={isText ? styles.statTextValue : styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function HistoryRow({
  cut,
  review,
  t,
}: {
  cut: Cut;
  review: CutReview | null;
  t: (key: any) => string;
}) {
  const date = new Date(cut.createdAt);
  const bcp47 = localeToBcp47(getCurrentLocale());
  const Icon = cut.wasReward ? Gift : Scissors;
  return (
    <Card>
      <View style={styles.histRow}>
        <View
          style={[
            styles.histIconWrap,
            cut.wasReward && { borderColor: colors.accent },
          ]}
        >
          <Icon
            color={cut.wasReward ? colors.accent : colors.primary}
            size={20}
            strokeWidth={2}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.histTitle}>
            {cut.wasReward ? t('salon.customer.cut.reward') : t('salon.customer.cut.paid')}
          </Text>
          <Text style={styles.histDate}>
            {date.toLocaleDateString(bcp47, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}{' '}
            ·{' '}
            {date.toLocaleTimeString(bcp47, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {cut.barberName ? (
            <Text style={styles.histBarber}>{cut.barberName}</Text>
          ) : null}
        </View>
        {review ? (
          <View style={styles.histReviewBadge}>
            <Star
              color={colors.accent}
              fill={colors.accent}
              size={12}
              strokeWidth={2}
            />
            <Text style={styles.histReviewBadgeText}>{review.rating}</Text>
          </View>
        ) : null}
      </View>
      {review?.comment ? (
        <View style={styles.histCommentRow}>
          <MessageSquare
            color={colors.textMuted}
            size={14}
            strokeWidth={2}
          />
          <Text style={styles.histComment} numberOfLines={3}>
            {review.comment}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  vipToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vipToggleActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 235, 59, 0.12)',
  },
  vipToggleText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
  vipToggleTextActive: {
    color: colors.accent,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  phone: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 2,
  },
  since: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  progressCard: {
    marginVertical: spacing.lg,
  },
  subscriptionCard: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  subscriptionCardActive: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.06)',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  subscriptionTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  subscriptionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  subscriptionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subscriptionCancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  subscriptionCancelText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  subscriptionReadOnlyHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  statTextValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  actionBtnText: {
    ...typography.button,
    color: colors.primary,
    fontSize: 14,
  },
  actionBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    color: colors.black,
    fontSize: 11,
    fontWeight: '800',
  },
  notesSection: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  notesInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  savingHint: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  notesLockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  notesLockedText: {
    flex: 1,
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyHistory: {
    ...typography.body,
    color: colors.textDim,
    fontStyle: 'italic',
    paddingVertical: spacing.md,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  histIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  histTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  histDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  histBarber: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  histReviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 235, 59, 0.12)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  histReviewBadgeText: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.accent,
  },
  histCommentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  histComment: {
    flex: 1,
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

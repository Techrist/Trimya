import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  QrCode,
  CalendarDays,
  CheckCircle2,
  Clock,
  ChevronRight,
  Footprints,
  X,
  Sparkles,
  Infinity as InfinityIcon,
  Star,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { Card } from '@/components/Card';
import { Logo } from '@/components/Logo';
import { QueueSignalSheet } from '@/components/QueueSignalSheet';
import { SubscriptionInfoSheet } from '@/components/SubscriptionInfoSheet';
import { ReviewSheet } from '@/components/ReviewSheet';
import { storage } from '@/services/storage';
import { subscribeCustomer } from '@/services/customers';
import { subscribeCustomerReservations, formatReservationDateTime, serviceLabel } from '@/services/reservations';
import { notifyRewardUnlocked } from '@/services/notifications';
import { registerPushTokenForCustomer } from '@/services/push';
import { getSalon } from '@/services/salons';
import { subscribeRecentCuts } from '@/services/cuts';
import {
  cancelQueueEntry,
  formatEta,
  signalArrival,
  subscribeCustomerActiveEntry,
} from '@/services/queue';
import {
  getReviewForCut,
  submitReview,
  isCutEligibleForReview,
} from '@/services/reviews';
import { useT } from '@/i18n';
import { daysRemaining, formatExpiry } from '@/services/subscriptions';
import { getLimits } from '@/lib/plans';
import { colors, radius, spacing, typography, REWARD_THRESHOLD } from '@/theme';
import {
  Customer,
  Cut,
  CutReview,
  QueueEntry,
  QueueEta,
  Reservation,
  Salon,
  isSubscriptionActive,
} from '@/types';

export function ClientDashboardScreen() {
  const nav = useNavigation<any>();
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextReservation, setNextReservation] = useState<Reservation | null>(null);
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [queueSheetVisible, setQueueSheetVisible] = useState(false);
  const [queueSubmitting, setQueueSubmitting] = useState(false);
  const [subInfoVisible, setSubInfoVisible] = useState(false);
  // Coupe en attente de notation (la plus récente non notée, < 7j, avec coiffeur)
  const [pendingReviewCut, setPendingReviewCut] = useState<Cut | null>(null);
  const [pendingReviewExisting, setPendingReviewExisting] =
    useState<CutReview | null>(null);
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const lastNotifiedCount = useRef<number | null>(null);
  // Tracking de la coupe la plus récente vue par le listener — sert à
  // distinguer "un nouveau scan vient d'arriver" vs "données déjà connues".
  const lastSeenCutIdRef = useRef<string | null>(null);
  /** Seuil pour décider si une coupe vient JUSTE d'être ajoutée (1 minute). */
  const FRESH_CUT_THRESHOLD_MS = 60 * 1000;

  useEffect(() => {
    let unsubCustomer: (() => void) | undefined;
    let unsubReservations: (() => void) | undefined;
    let unsubQueue: (() => void) | undefined;
    let unsubCuts: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) {
        setLoading(false);
        return;
      }
      registerPushTokenForCustomer(id);

      unsubCustomer = subscribeCustomer(id, (c) => {
        setCustomer(c);
        setLoading(false);

        if (
          c &&
          c.currentCount === REWARD_THRESHOLD &&
          lastNotifiedCount.current !== c.currentCount
        ) {
          lastNotifiedCount.current = c.currentCount;
          notifyRewardUnlocked();
        }
        if (c && c.currentCount !== REWARD_THRESHOLD) {
          lastNotifiedCount.current = c.currentCount;
        }
        if (c?.salonId) {
          // On charge le salon une seule fois pour avoir kioskPushToken
          // côté push, et pas en live (overkill ici).
          getSalon(c.salonId).then(setSalon).catch(() => setSalon(null));
        }
      });

      unsubReservations = subscribeCustomerReservations(id, (list) => {
        const now = Date.now();
        const upcoming = list
          .filter(
            (r) =>
              (r.status === 'confirmed' || r.status === 'pending' || r.status === 'proposed') &&
              (r.proposedFor || r.scheduledFor) >= now,
          )
          .sort(
            (a, b) =>
              (a.proposedFor || a.scheduledFor) - (b.proposedFor || b.scheduledFor),
          );
        setNextReservation(upcoming[0] || null);
      });

      unsubQueue = subscribeCustomerActiveEntry(id, setQueueEntry);

      // Souscription aux coupes récentes : deux comportements selon contexte.
      //  - Au premier snapshot : si la coupe la plus récente est < 60s et a un
      //    coiffeur et pas encore notée → on OUVRE direct la modale (le client
      //    vient d'être scanné juste avant d'ouvrir l'app, ou il était déjà dedans).
      //  - Sur snapshots suivants : si une NOUVELLE coupe arrive (id différent),
      //    on ouvre direct la modale (scan en temps réel, app déjà ouverte).
      //  - Sinon on tombe sur l'affichage passif (carte jaune en haut du dashboard).
      unsubCuts = subscribeRecentCuts(
        id,
        async (cuts) => {
          if (cuts.length === 0) {
            setPendingReviewCut(null);
            setPendingReviewExisting(null);
            return;
          }
          const latest = cuts[0];
          const isFirstFire = lastSeenCutIdRef.current === null;
          const isNewCut =
            !isFirstFire && latest.id !== lastSeenCutIdRef.current;
          const isFresh = Date.now() - latest.createdAt < FRESH_CUT_THRESHOLD_MS;
          lastSeenCutIdRef.current = latest.id;

          // Cherche la première coupe éligible à notation (peut être la plus
          // récente, ou une plus ancienne si la dernière n'a pas de coiffeur).
          const candidate = cuts.find((c) => isCutEligibleForReview(c));
          if (!candidate) {
            setPendingReviewCut(null);
            setPendingReviewExisting(null);
            return;
          }

          try {
            const existing = await getReviewForCut(candidate.id);
            if (existing) {
              setPendingReviewCut(null);
              setPendingReviewExisting(null);
              return;
            }
            setPendingReviewCut(candidate);
            setPendingReviewExisting(null);

            // Auto-ouverture si :
            //  - la coupe candidate est la plus récente
            //  - ET (nouveau scan détecté en live OU coupe toute fraîche au 1er fire)
            const shouldAutoOpen =
              candidate.id === latest.id &&
              (isNewCut || (isFirstFire && isFresh));
            if (shouldAutoOpen) {
              try {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              } catch {
                /* ignore — haptics indispo sur certains devices */
              }
              setReviewSheetVisible(true);
            }
          } catch {
            setPendingReviewCut(null);
          }
        },
        5,
      );
    })();
    return () => {
      unsubCustomer?.();
      unsubReservations?.();
      unsubQueue?.();
      unsubCuts?.();
    };
  }, []);

  const handleConfirmEta = async (eta: QueueEta) => {
    if (!customer) return;
    setQueueSubmitting(true);
    try {
      await signalArrival({ customer, etaMinutes: eta, salon });
      setQueueSheetVisible(false);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || String(e));
    } finally {
      setQueueSubmitting(false);
    }
  };

  const handleSubmitReview = async (rating: 1 | 2 | 3 | 4 | 5, comment: string) => {
    if (!pendingReviewCut) return;
    setReviewSubmitting(true);
    try {
      await submitReview({
        cut: pendingReviewCut,
        rating,
        comment: comment || undefined,
      });
      setReviewSheetVisible(false);
      // Le useEffect cuts va re-tirer et clear le pendingReviewCut automatiquement.
      setPendingReviewCut(null);
      Alert.alert(t('review.thanks.title'), t('review.thanks.text'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || String(e));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleCancelQueue = () => {
    if (!queueEntry) return;
    Alert.alert(
      t('queue.client.cancelConfirmTitle'),
      t('queue.client.cancelConfirmText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('queue.client.cancelConfirmCta'),
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelQueueEntry(queueEntry.id, 'customer');
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message || String(e));
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  if (!customer) {
    return (
      <Screen padded centered>
        <Text style={styles.errTitle}>{t('client.dashboard.accountNotFound')}</Text>
        <Text style={styles.errText}>{t('client.dashboard.accountNotFoundHint')}</Text>
      </Screen>
    );
  }

  const isReady = customer.currentCount >= REWARD_THRESHOLD;
  const subscribed = isSubscriptionActive(customer);
  // Limites du SALON (pas de l'owner — côté client on n'a pas accès au doc owner).
  // Si le salon est en plan Entreprise via owner, le client ne le verra pas mais
  // le salon a normalement aussi un plan direct (Pro) qui couvre l'usage normal.
  const salonLimits = salon ? getLimits(salon) : null;
  const queueAvailable = salonLimits?.queueSignal ?? false;
  const subscriptionsAvailable = salonLimits?.subscriptions ?? false;

  return (
    <Screen padded scroll>
      <View style={styles.topBar}>
        <Logo size={36} />
      </View>

      <Text style={styles.greeting}>
        {t('client.dashboard.greeting', { name: customer.name || t('client.dashboard.greetingFallback') })}
      </Text>

      {subscribed ? (
        <SubscriptionCard customer={customer} />
      ) : (
        <Card style={styles.progressCard} elevated>
          <ProgressIndicator count={customer.currentCount} />
        </Card>
      )}

      {!subscribed && subscriptionsAvailable && (salon?.subscriptionPrice || 0) > 0 ? (
        <SubscriptionDiscoveryCard
          salon={salon}
          onPress={() => setSubInfoVisible(true)}
        />
      ) : null}

      {pendingReviewCut ? (
        <Pressable
          onPress={() => setReviewSheetVisible(true)}
          style={styles.reviewPromptCard}
        >
          <View style={styles.reviewPromptIcon}>
            <Star
              color={colors.accent}
              fill={colors.accent}
              size={22}
              strokeWidth={2.2}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewPromptTitle}>
              {t('review.prompt.title')}
            </Text>
            <Text style={styles.reviewPromptBody} numberOfLines={2}>
              {t('review.prompt.body', {
                barber: pendingReviewCut.barberName || '',
              })}
            </Text>
            <Text style={styles.reviewPromptCta}>
              {t('review.prompt.cta')}
            </Text>
          </View>
          <ChevronRight color={colors.accent} size={20} strokeWidth={2.4} />
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={() => nav.navigate('ClientQr')}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryAction}
          >
            <QrCode color={colors.black} size={26} strokeWidth={2.2} />
            <Text style={styles.primaryActionText}>
              {isReady ? t('client.dashboard.showQrReward') : t('client.dashboard.showQr')}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => nav.navigate('ReservationsTab', { screen: 'ReservationForm' })}
          style={styles.secondaryAction}
        >
          <CalendarDays color={colors.primary} size={20} strokeWidth={2.2} />
          <Text style={styles.secondaryActionText}>{t('client.dashboard.bookSlot')}</Text>
        </Pressable>

        {queueAvailable ? (
          queueEntry ? (
            <QueueActiveCard
              entry={queueEntry}
              onUpdate={() => setQueueSheetVisible(true)}
              onCancel={handleCancelQueue}
            />
          ) : (
            <Pressable
              onPress={() => setQueueSheetVisible(true)}
              style={styles.queueAction}
            >
              <Footprints color={colors.primary} size={20} strokeWidth={2.2} />
              <Text style={styles.queueActionText}>
                {t('queue.client.cta')}
              </Text>
            </Pressable>
          )
        ) : (
          <FeatureUnavailableCard
            icon={
              <Footprints color={colors.textMuted} size={18} strokeWidth={2.2} />
            }
            title={t('queue.client.unavailableTitle')}
            body={t('queue.client.unavailableBody')}
          />
        )}
      </View>

      {nextReservation && <NextReservationCard r={nextReservation} onPress={() => nav.navigate('ReservationsTab')} />}

      <Pressable
        onPress={() => nav.navigate('ClientHistory')}
        style={styles.historyLink}
      >
        <Clock color={colors.textMuted} size={18} strokeWidth={2} />
        <Text style={styles.historyLinkText}>{t('client.dashboard.viewHistory')}</Text>
        <ChevronRight color={colors.textDim} size={18} strokeWidth={2} />
      </Pressable>

      <QueueSignalSheet
        visible={queueSheetVisible}
        loading={queueSubmitting}
        initialEta={queueEntry?.etaMinutes}
        onCancel={() => setQueueSheetVisible(false)}
        onConfirm={handleConfirmEta}
      />

      <SubscriptionInfoSheet
        visible={subInfoVisible}
        salon={salon}
        onClose={() => setSubInfoVisible(false)}
      />

      {pendingReviewCut ? (
        <ReviewSheet
          visible={reviewSheetVisible}
          barberName={pendingReviewCut.barberName || ''}
          existing={pendingReviewExisting}
          loading={reviewSubmitting}
          onCancel={() => setReviewSheetVisible(false)}
          onSubmit={handleSubmitReview}
        />
      ) : null}
    </Screen>
  );
}

function FeatureUnavailableCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.unavailableCard}>
      <View style={styles.unavailableIconWrap}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.unavailableTitle}>{title}</Text>
        <Text style={styles.unavailableBody}>{body}</Text>
      </View>
    </View>
  );
}

function SubscriptionDiscoveryCard({
  salon,
  onPress,
}: {
  salon: Salon | null;
  onPress: () => void;
}) {
  const { t } = useT();
  const currency = salon?.currency || 'FCFA';
  const price = salon?.subscriptionPrice || 0;

  return (
    <Pressable onPress={onPress} style={styles.discoveryCard}>
      <View style={styles.discoveryIconWrap}>
        <Sparkles color={colors.primary} size={22} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.discoveryTitle}>
          {t('subscription.discovery.title')}
        </Text>
        <Text style={styles.discoverySubtitle} numberOfLines={2}>
          {t('subscription.discovery.subtitle', {
            price: price.toLocaleString('fr-FR'),
            currency,
          })}
        </Text>
        <Text style={styles.discoveryCta}>
          {t('subscription.discovery.cta')}
        </Text>
      </View>
      <ChevronRight color={colors.primary} size={20} strokeWidth={2.4} />
    </Pressable>
  );
}

function SubscriptionCard({ customer }: { customer: Customer }) {
  const { t } = useT();
  const expiresAt = customer.subscriptionExpiresAt || 0;
  const days = daysRemaining(customer);
  // Rappel de renouvellement quand l'abonnement expire dans 3 jours ou moins.
  const renewalWarning = days <= 3;

  return (
    <View style={styles.subscriptionCard}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={styles.subscriptionContent}
        pointerEvents="none"
        collapsable={false}
      >
        <View style={styles.subscriptionIconRow}>
          <Sparkles color={colors.black} size={22} strokeWidth={2.4} />
          <Text style={styles.subscriptionBadge}>
            {t('subscription.client.badge')}
          </Text>
        </View>
        <View style={styles.subscriptionTitleRow}>
          <InfinityIcon color={colors.black} size={36} strokeWidth={2.4} />
          <Text style={styles.subscriptionMainText}>
            {t('subscription.client.unlimited')}
          </Text>
        </View>
        <View style={styles.subscriptionFooter}>
          <Text style={styles.subscriptionDaysValue}>
            {days}
          </Text>
          <Text style={styles.subscriptionDaysLabel}>
            {t(
              days > 1 ? 'subscription.client.daysLeftPlural' : 'subscription.client.daysLeft',
            )}
          </Text>
        </View>
        <Text style={styles.subscriptionExpiry}>
          {t('subscription.client.expiresOn', { date: formatExpiry(expiresAt) })}
        </Text>

        {renewalWarning ? (
          <View style={styles.renewalBanner}>
            <Text style={styles.renewalBannerText}>
              {t(
                days <= 1
                  ? 'subscription.client.renewalUrgent'
                  : 'subscription.client.renewalSoon',
                { count: days },
              )}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function QueueActiveCard({
  entry,
  onUpdate,
  onCancel,
}: {
  entry: QueueEntry;
  onUpdate: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const expectedTime = new Date(entry.expectedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View style={styles.queueActive}>
      <View style={styles.queueActiveHeader}>
        <Footprints color={colors.primary} size={22} strokeWidth={2.2} />
        <Text style={styles.queueActiveLabel}>{t('queue.client.activeLabel')}</Text>
      </View>
      <Text style={styles.queueActiveTitle}>
        {t('queue.client.activeTitle', {
          eta: formatEta(entry.etaMinutes),
        })}
      </Text>
      <Text style={styles.queueActiveSubtitle}>
        {t('queue.client.activeSubtitle', { time: expectedTime })}
      </Text>
      <View style={styles.queueActiveActions}>
        <Pressable onPress={onUpdate} style={styles.queueActiveBtn}>
          <Clock color={colors.primary} size={16} strokeWidth={2.2} />
          <Text style={styles.queueActiveBtnText}>
            {t('queue.client.updateEta')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={[styles.queueActiveBtn, styles.queueActiveBtnDanger]}
        >
          <X color={colors.danger} size={16} strokeWidth={2.2} />
          <Text style={[styles.queueActiveBtnText, { color: colors.danger }]}>
            {t('queue.client.cancel')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function NextReservationCard({
  r,
  onPress,
}: {
  r: Reservation;
  onPress: () => void;
}) {
  const meta = formatReservationDateTime(
    r.status === 'proposed' ? r.proposedFor || r.scheduledFor : r.scheduledFor,
  );
  const tone =
    r.status === 'confirmed'
      ? { color: colors.success, label: 'Confirmé', Icon: CheckCircle2 }
      : r.status === 'proposed'
        ? { color: colors.primary, label: 'Contre-proposition', Icon: Clock }
        : { color: colors.accent, label: 'En attente', Icon: Clock };

  return (
    <Pressable onPress={onPress} style={{ marginTop: spacing.lg }}>
      <Card style={[{ borderColor: tone.color, borderWidth: 1.5 }]}>
        <View style={styles.nextHeader}>
          <tone.Icon color={tone.color} size={18} strokeWidth={2.2} />
          <Text style={[styles.nextLabel, { color: tone.color }]}>{tone.label}</Text>
        </View>
        <Text style={styles.nextTitle}>Mon prochain rendez-vous</Text>
        <Text style={styles.nextDate}>{meta.date}</Text>
        <Text style={styles.nextTime}>{meta.time}</Text>
        <Text style={styles.nextService}>{serviceLabel(r.service)}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  greeting: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  greetingName: {
    color: colors.primary,
  },
  // Padding réduit pour que la carte tienne en hauteur sans scroll.
  // Le composant ProgressIndicator a déjà été compacté en interne.
  progressCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  subscriptionCard: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    overflow: 'hidden',
    backgroundColor: colors.primary, // fallback Android
    minHeight: 180,
  },
  subscriptionContent: {
    gap: spacing.sm,
  },
  subscriptionIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subscriptionBadge: {
    ...typography.caption,
    color: colors.black,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    includeFontPadding: false,
  },
  subscriptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  subscriptionMainText: {
    ...typography.h1,
    color: colors.black,
    flex: 1,
    includeFontPadding: false,
  },
  subscriptionFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  subscriptionDaysValue: {
    ...typography.h1,
    color: colors.black,
    fontSize: 40,
    fontWeight: '800',
    includeFontPadding: false,
  },
  subscriptionDaysLabel: {
    ...typography.bodyBold,
    color: colors.black,
    includeFontPadding: false,
  },
  subscriptionExpiry: {
    ...typography.caption,
    color: 'rgba(0,0,0,0.7)',
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  renewalBanner: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  renewalBannerText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  discoveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.06)',
    marginBottom: spacing.lg,
  },
  discoveryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoveryTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  discoverySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  discoveryCta: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  reviewPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 235, 59, 0.08)',
    marginBottom: spacing.lg,
  },
  reviewPromptIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 235, 59, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPromptTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  reviewPromptBody: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  reviewPromptCta: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '800',
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 20,
  },
  primaryActionText: {
    ...typography.button,
    color: colors.black,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  secondaryActionText: {
    ...typography.button,
    color: colors.primary,
  },
  queueAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  queueActionText: {
    ...typography.button,
    color: colors.text,
  },
  unavailableCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
  },
  unavailableIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  unavailableBody: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  queueActive: {
    backgroundColor: 'rgba(255, 87, 34, 0.10)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    padding: spacing.md,
  },
  queueActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  queueActiveLabel: {
    ...typography.caption,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  queueActiveTitle: {
    ...typography.h3,
    color: colors.text,
  },
  queueActiveSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  queueActiveActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  queueActiveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  queueActiveBtnDanger: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(244,67,54,0.06)',
  },
  queueActiveBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text,
  },
  nextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  nextLabel: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  nextTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  nextDate: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  nextTime: {
    ...typography.h2,
    color: colors.primary,
  },
  nextService: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  historyLinkText: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  errTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errText: {
    ...typography.body,
    color: colors.textMuted,
  },
});

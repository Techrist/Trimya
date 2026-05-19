import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getCountFromServer,
  getDocs,
} from 'firebase/firestore';
import {
  ChevronLeft,
  Users,
  Scissors,
  Wallet,
  Building2,
  MapPin,
  Phone,
  Sparkles,
  Footprints,
  Clock,
  Star,
  AlertTriangle,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { db } from '@/services/firebase';
import {
  getSalonSubscriptionMetrics,
  getSalonQueueMetrics,
  computeOpeningHoursMetrics,
  type SubscriptionMetrics,
  type QueueMetrics,
} from '@/services/metrics';
import {
  getBarberRatingsForSalon,
  isBarberFlagged,
  type BarberRatingAggregate,
} from '@/services/reviews';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Salon, Cut } from '@/types';
import { OwnerSalonsStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerSalonsStackParamList, 'OwnerSalonDetail'>;
type Rt = RouteProp<OwnerSalonsStackParamList, 'OwnerSalonDetail'>;

const DAY_MS = 24 * 60 * 60 * 1000;

interface SalonStats {
  customers: number;
  cuts30d: number;
  revenue30d: number;
}

export function OwnerSalonDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { salonId } = route.params;
  const { t } = useT();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [stats, setStats] = useState<SalonStats | null>(null);
  const [subMetrics, setSubMetrics] = useState<SubscriptionMetrics | null>(null);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null);
  const [barberRatings, setBarberRatings] = useState<BarberRatingAggregate[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'salons', salonId), (snap) => {
      if (snap.exists()) {
        setSalon({ id: snap.id, ...(snap.data() as Omit<Salon, 'id'>) });
      }
    });
    return unsub;
  }, [salonId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const since = Date.now() - 30 * DAY_MS;
        const [agg, cutsSnap, subs, queue, ratingsMap] = await Promise.all([
          getCountFromServer(
            query(collection(db, 'customers'), where('salonId', '==', salonId)),
          ),
          getDocs(
            query(
              collection(db, 'cuts'),
              where('salonId', '==', salonId),
              where('createdAt', '>=', since),
            ),
          ),
          getSalonSubscriptionMetrics(salonId),
          getSalonQueueMetrics(salonId),
          getBarberRatingsForSalon(salonId),
        ]);
        if (cancelled) return;
        const cuts = cutsSnap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<Cut, 'id'>) }),
        );
        const revenue30d = cuts
          .filter((c) => !c.wasReward)
          .reduce((sum, c) => sum + (c.price ?? 0), 0);
        setStats({
          customers: agg.data().count,
          cuts30d: cuts.length,
          revenue30d,
        });
        setSubMetrics(subs);
        setQueueMetrics(queue);
        // Tri : signalés en rouge en premier, puis par note croissante (plus mauvais d'abord)
        const sorted = Array.from(ratingsMap.values()).sort((a, b) => {
          const aFlag = isBarberFlagged(a) ? 1 : 0;
          const bFlag = isBarberFlagged(b) ? 1 : 0;
          if (aFlag !== bFlag) return bFlag - aFlag;
          return a.averageRating - b.averageRating;
        });
        setBarberRatings(sorted);
      } catch (e: any) {
        if (!cancelled) Alert.alert(t('common.error'), e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [salonId, t]);

  if (!salon) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  return (
    <Screen padded scroll>
      <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
        <ChevronLeft color={colors.textMuted} size={22} strokeWidth={2.2} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Building2 color={colors.primary} size={32} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>{salon.name}</Text>
        <View style={styles.metaRow}>
          {salon.city ? (
            <View style={styles.metaItem}>
              <MapPin color={colors.textMuted} size={14} strokeWidth={2} />
              <Text style={styles.meta}>{salon.city}</Text>
            </View>
          ) : null}
          {salon.phone ? (
            <View style={styles.metaItem}>
              <Phone color={colors.textMuted} size={14} strokeWidth={2} />
              <Text style={styles.meta}>{salon.phone}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* KPI cards */}
      <View style={styles.statsGrid}>
        <StatCard
          Icon={Users}
          label={t('owner.salon.stat.customers')}
          value={stats ? String(stats.customers) : '—'}
          tone="accent"
        />
        <StatCard
          Icon={Scissors}
          label={t('owner.salon.stat.cuts30d')}
          value={stats ? String(stats.cuts30d) : '—'}
          tone="primary"
        />
      </View>

      <Card style={styles.revenueCard}>
        <View style={styles.revenueRow}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: 'rgba(34, 197, 94, 0.12)' },
            ]}
          >
            <Wallet color={colors.success} size={22} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>
              {t('owner.salon.stat.revenue30d')}
            </Text>
            <Text style={styles.revenue}>
              {stats
                ? `${new Intl.NumberFormat('fr-FR').format(stats.revenue30d)} FCFA`
                : '—'}
            </Text>
          </View>
        </View>
      </Card>

      {/* ─── Abonnements coupes illimitées ──────────────── */}
      <Text style={styles.sectionTitle}>
        {t('owner.salon.subscriptions.title')}
      </Text>
      <Card style={styles.subSection}>
        <View style={styles.subRow}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: 'rgba(255, 87, 34, 0.12)' },
            ]}
          >
            <Sparkles color={colors.primary} size={22} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subBigValue}>
              {subMetrics ? subMetrics.activeCount : '—'}
            </Text>
            <Text style={styles.subLabel}>
              {t('owner.salon.subscriptions.activeLabel')}
            </Text>
          </View>
        </View>
        <View style={styles.subFooter}>
          <View style={styles.subFooterItem}>
            <Text style={styles.subFooterLabel}>
              {t('owner.salon.subscriptions.revenueMonth')}
            </Text>
            <Text style={styles.subFooterValue}>
              {subMetrics
                ? `${new Intl.NumberFormat('fr-FR').format(subMetrics.revenueThisMonth)} ${salon.currency || 'FCFA'}`
                : '—'}
            </Text>
          </View>
          <View style={styles.subFooterItem}>
            <Text style={styles.subFooterLabel}>
              {t('owner.salon.subscriptions.activationsMonth')}
            </Text>
            <Text style={styles.subFooterValue}>
              {subMetrics ? subMetrics.activationsThisMonth : '—'}
            </Text>
          </View>
        </View>
      </Card>

      {/* ─── File d'attente "Je suis en route" ──────────── */}
      <Text style={styles.sectionTitle}>
        {t('owner.salon.queue.title')}
      </Text>
      <Card style={styles.subSection}>
        <View style={styles.queueRow}>
          <QueuePill
            Icon={Footprints}
            value={queueMetrics ? queueMetrics.signaledToday : '—'}
            label={t('owner.salon.queue.today')}
          />
          <QueuePill
            Icon={Footprints}
            value={queueMetrics ? queueMetrics.signaledWeek : '—'}
            label={t('owner.salon.queue.week')}
          />
          <QueuePill
            Icon={Footprints}
            value={
              queueMetrics
                ? queueMetrics.arrivalRate !== null
                  ? `${queueMetrics.arrivalRate}%`
                  : '—'
                : '—'
            }
            label={t('owner.salon.queue.arrivalRate')}
            highlight
          />
        </View>
      </Card>

      {/* ─── Horaires d'ouverture ────────────────────────── */}
      <Card style={styles.hoursCard}>
        <View style={styles.subRow}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: 'rgba(255, 235, 59, 0.12)' },
            ]}
          >
            <Clock color={colors.accent} size={22} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>
              {t('owner.salon.hours.label')}
            </Text>
            {(() => {
              const m = computeOpeningHoursMetrics(salon.openingHours);
              return (
                <Text style={styles.hoursValue}>
                  {m.configured
                    ? t('owner.salon.hours.configured', { count: m.openDaysCount })
                    : t('owner.salon.hours.notConfigured')}
                </Text>
              );
            })()}
          </View>
        </View>
      </Card>

      {/* ─── Notes coiffeurs ────────────────────────────── */}
      <Text style={styles.sectionTitle}>
        {t('owner.salon.ratings.title')}
      </Text>
      <Card style={styles.subSection}>
        {barberRatings.length === 0 ? (
          <Text style={styles.ratingsEmpty}>
            {t('owner.salon.ratings.empty')}
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {barberRatings.slice(0, 5).map((r, idx) => {
              const flagged = isBarberFlagged(r);
              return (
                <View
                  key={r.barberId}
                  style={[
                    styles.ratingRow,
                    flagged && styles.ratingRowFlagged,
                    idx > 0 && !flagged && styles.ratingRowDivider,
                  ]}
                >
                  <View style={styles.ratingStars}>
                    <Star
                      color={colors.accent}
                      fill={colors.accent}
                      size={14}
                      strokeWidth={2}
                    />
                    <Text style={styles.ratingNumber}>
                      {r.averageRating.toFixed(1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.ratingNameRow}>
                      <Text style={styles.ratingName} numberOfLines={1}>
                        {r.barberName || '—'}
                      </Text>
                      {flagged ? (
                        <AlertTriangle
                          color={colors.danger}
                          size={14}
                          strokeWidth={2.4}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.ratingMeta}>
                      {t(
                        r.reviewCount > 1
                          ? 'owner.salon.ratings.reviewsCountPlural'
                          : 'owner.salon.ratings.reviewsCount',
                        { count: r.reviewCount },
                      )}
                    </Text>
                  </View>
                </View>
              );
            })}
            {barberRatings.some(isBarberFlagged) ? (
              <View style={styles.alertBanner}>
                <AlertTriangle
                  color={colors.danger}
                  size={14}
                  strokeWidth={2.4}
                />
                <Text style={styles.alertText}>
                  {t('owner.salon.ratings.alertText', {
                    count: barberRatings.filter(isBarberFlagged).length,
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </Card>

      {/* Infos salon */}
      <Card>
        <Text style={styles.sectionLabel}>{t('owner.salon.info.title')}</Text>
        <InfoRow label={t('owner.salon.info.owner')} value={salon.ownerName ?? '—'} />
        <InfoRow label={t('owner.salon.info.code')} value={salon.activationCode} mono />
        <InfoRow
          label={t('owner.salon.info.kiosks')}
          value={String(salon.kioskUserIds?.length ?? 0)}
        />
        <InfoRow
          label={t('owner.salon.info.status')}
          value={
            salon.disabledAt
              ? t('owner.salons.status.disabled')
              : salon.activatedAt && salon.activatedAt > 0
                ? t('owner.salons.status.activated')
                : t('owner.salons.status.pending')
          }
        />
      </Card>

      <Text style={styles.readonlyHint}>{t('owner.salon.readonlyHint')}</Text>
    </Screen>
  );
}

function QueuePill({
  Icon,
  value,
  label,
  highlight = false,
}: {
  Icon: typeof Users;
  value: number | string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.queuePill}>
      <View
        style={[
          styles.queuePillIcon,
          highlight && { backgroundColor: 'rgba(34, 197, 94, 0.12)' },
        ]}
      >
        <Icon
          color={highlight ? colors.success : colors.primary}
          size={16}
          strokeWidth={2.2}
        />
      </View>
      <Text
        style={[
          styles.queuePillValue,
          highlight && { color: colors.success },
        ]}
      >
        {value}
      </Text>
      <Text style={styles.queuePillLabel}>{label}</Text>
    </View>
  );
}

function StatCard({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: typeof Users;
  label: string;
  value: string;
  tone: 'primary' | 'accent';
}) {
  const bg =
    tone === 'primary' ? 'rgba(255, 87, 34, 0.12)' : 'rgba(255, 235, 59, 0.12)';
  const fg = tone === 'primary' ? colors.primary : colors.accent;
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Icon color={fg} size={18} strokeWidth={2.2} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && { fontFamily: 'Courier' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backText: {
    ...typography.body,
    color: colors.textMuted,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  revenueCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subSection: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subBigValue: {
    ...typography.h1,
    color: colors.text,
  },
  subLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  subFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subFooterItem: {
    flex: 1,
  },
  subFooterLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  subFooterValue: {
    ...typography.bodyBold,
    color: colors.text,
    marginTop: 2,
  },
  queueRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  queuePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  queuePillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  queuePillValue: {
    ...typography.h2,
    color: colors.text,
  },
  queuePillLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  hoursCard: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  hoursValue: {
    ...typography.bodyBold,
    color: colors.text,
    marginTop: 2,
  },
  ratingsEmpty: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  ratingRowFlagged: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  ratingRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 50,
  },
  ratingNumber: {
    ...typography.bodyBold,
    color: colors.accent,
  },
  ratingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingName: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  ratingMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  alertText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
    flex: 1,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  revenue: {
    ...typography.h1,
    color: colors.success,
    marginTop: 2,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  readonlyHint: {
    ...typography.caption,
    color: colors.textDim,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});

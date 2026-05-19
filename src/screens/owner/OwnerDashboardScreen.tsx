import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import {
  Store,
  Users,
  Scissors,
  Gift,
  Wallet,
  Trophy,
  Sparkles,
  Footprints,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { db } from '@/services/firebase';
import { useOwner } from '@/hooks/useOwner';
import { useApp } from '@/contexts/AppContext';
import {
  getOwnerAggregatedMetrics,
  type OwnerAggregatedMetrics,
} from '@/services/metrics';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Cut } from '@/types';
import {
  PLANS,
  isOwnerEnterpriseActive,
  planExpiresInDays,
  getPlanLabel,
  type OwnerPlanId,
} from '@/lib/plans';

const DAY_MS = 24 * 60 * 60 * 1000;

interface ConsolidatedStats {
  totalCustomers: number;
  cuts30d: number;
  rewards30d: number;
  revenue30d: number;
  topSalon?: { salonId: string; salonName: string; cuts: number };
}

export function OwnerDashboardScreen() {
  const { ownerId } = useApp();
  const { owner, salons } = useOwner(ownerId);
  const { t } = useT();
  const [stats, setStats] = useState<ConsolidatedStats | null>(null);
  const [features, setFeatures] = useState<OwnerAggregatedMetrics | null>(null);

  // Charge les stats agrégées sur tous les salons de l'owner.
  useEffect(() => {
    if (salons.length === 0) {
      setStats({
        totalCustomers: 0,
        cuts30d: 0,
        rewards30d: 0,
        revenue30d: 0,
      });
      return;
    }
    let cancelled = false;
    (async () => {
      const since = Date.now() - 30 * DAY_MS;
      const salonIds = salons.map((s) => s.id);

      // Cuts récents sur tous les salons (max 30 ids dans 'in')
      const cuts: Cut[] = [];
      for (let i = 0; i < salonIds.length; i += 10) {
        const chunk = salonIds.slice(i, i + 10);
        const q = query(
          collection(db, 'cuts'),
          where('salonId', 'in', chunk),
          where('createdAt', '>=', since),
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          cuts.push({ id: d.id, ...(d.data() as Omit<Cut, 'id'>) });
        }
      }

      // Customers count sur tous les salons (compte simple par doc)
      let totalCustomers = 0;
      for (let i = 0; i < salonIds.length; i += 10) {
        const chunk = salonIds.slice(i, i + 10);
        const q = query(
          collection(db, 'customers'),
          where('salonId', 'in', chunk),
        );
        const snap = await getDocs(q);
        totalCustomers += snap.size;
      }

      if (cancelled) return;

      const cutsBySalon = new Map<string, number>();
      let cuts30d = 0;
      let rewards30d = 0;
      let revenue30d = 0;
      for (const c of cuts) {
        cuts30d++;
        if (c.wasReward) rewards30d++;
        else revenue30d += c.price ?? 0;
        cutsBySalon.set(c.salonId, (cutsBySalon.get(c.salonId) ?? 0) + 1);
      }

      const top = Array.from(cutsBySalon.entries())
        .sort((a, b) => b[1] - a[1])[0];
      const topSalon = top
        ? {
            salonId: top[0],
            salonName: salons.find((s) => s.id === top[0])?.name ?? top[0],
            cuts: top[1],
          }
        : undefined;

      setStats({
        totalCustomers,
        cuts30d,
        rewards30d,
        revenue30d,
        topSalon,
      });

      // Métriques par feature (abonnement / file d'attente / horaires) en parallèle.
      // Pas critique : si ça échoue ou prend du temps, le reste du dashboard tourne déjà.
      try {
        const f = await getOwnerAggregatedMetrics(
          salons.map((s) => ({ id: s.id, openingHours: s.openingHours })),
        );
        if (!cancelled) setFeatures(f);
      } catch {
        /* ignore — affichage tombe en '—' */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [salons]);

  const limit = PLANS.enterprise.limits.maxSalons ?? 5;
  const enterprise = owner ? isOwnerEnterpriseActive(owner) : false;
  const expiresInDays = owner ? planExpiresInDays(owner) : null;

  if (!owner) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  return (
    <Screen padded scroll>
      <Text style={styles.welcome}>{t('owner.dashboard.welcome', { name: owner.name })}</Text>
      <Text style={styles.title}>{t('owner.dashboard.title')}</Text>
      <Text style={styles.subtitle}>{t('owner.dashboard.subtitle')}</Text>

      {/* Plan summary */}
      <Card style={styles.planCard}>
        <View style={styles.planHeader}>
          <View
            style={[
              styles.planIcon,
              { backgroundColor: enterprise ? 'rgba(255, 235, 59, 0.12)' : colors.surfaceElevated },
            ]}
          >
            <Trophy
              color={enterprise ? colors.accent : colors.textMuted}
              size={22}
              strokeWidth={2.2}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planLabel}>{t('owner.dashboard.planLabel')}</Text>
            <Text style={styles.planName}>
              {enterprise && owner.plan
                ? getPlanLabel(owner.plan as OwnerPlanId, t)
                : t('owner.dashboard.noPlan')}
            </Text>
            <Text style={styles.planMeta}>
              {enterprise && expiresInDays !== null && expiresInDays > 0
                ? t('owner.dashboard.expiresIn', { days: expiresInDays })
                : enterprise
                  ? t('owner.dashboard.noExpiry')
                  : t('owner.dashboard.noPlanHint')}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.statsGrid}>
        <Stat
          Icon={Store}
          label={t('owner.dashboard.stat.salons')}
          value={`${salons.length} / ${limit}`}
          tone="primary"
        />
        <Stat
          Icon={Users}
          label={t('owner.dashboard.stat.customers')}
          value={stats ? String(stats.totalCustomers) : '—'}
          tone="accent"
        />
        <Stat
          Icon={Scissors}
          label={t('owner.dashboard.stat.cuts30d')}
          value={stats ? String(stats.cuts30d) : '—'}
          tone="primary"
        />
        <Stat
          Icon={Gift}
          label={t('owner.dashboard.stat.rewards30d')}
          value={stats ? String(stats.rewards30d) : '—'}
          tone="accent"
        />
      </View>

      <Card>
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
              {t('owner.dashboard.stat.revenue30d')}
            </Text>
            <Text style={styles.revenue}>
              {stats
                ? `${new Intl.NumberFormat('fr-FR').format(stats.revenue30d)} FCFA`
                : '—'}
            </Text>
            <Text style={styles.fieldHint}>
              {t('owner.dashboard.stat.revenueHint')}
            </Text>
          </View>
        </View>
      </Card>

      {stats?.topSalon ? (
        <Card style={styles.topSalonCard}>
          <View style={styles.revenueRow}>
            <View
              style={[
                styles.statIcon,
                { backgroundColor: 'rgba(255, 235, 59, 0.12)' },
              ]}
            >
              <Trophy color={colors.accent} size={22} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>
                {t('owner.dashboard.topSalonLabel')}
              </Text>
              <Text style={styles.topSalonName}>{stats.topSalon.salonName}</Text>
              <Text style={styles.fieldHint}>
                {t('owner.dashboard.topSalonCuts', { count: stats.topSalon.cuts })}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* ─── Engagement clientèle (features avancées) ────── */}
      <Text style={styles.featuresTitle}>
        {t('owner.dashboard.featuresTitle')}
      </Text>

      <Card style={styles.featureCard}>
        <View style={styles.featureRow}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: 'rgba(255, 87, 34, 0.12)' },
            ]}
          >
            <Sparkles color={colors.primary} size={22} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>
              {t('owner.dashboard.subscriptions.label')}
            </Text>
            <Text style={styles.featureBig}>
              {features ? features.totalActiveSubscriptions : '—'}
            </Text>
            <Text style={styles.fieldHint}>
              {features
                ? t('owner.dashboard.subscriptions.revenue', {
                    amount: new Intl.NumberFormat('fr-FR').format(
                      features.totalSubscriptionRevenueThisMonth,
                    ),
                  })
                : '—'}
            </Text>
          </View>
        </View>
      </Card>

      <Card style={styles.featureCard}>
        <View style={styles.featureRow}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: 'rgba(255, 87, 34, 0.12)' },
            ]}
          >
            <Footprints color={colors.primary} size={22} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>
              {t('owner.dashboard.queue.label')}
            </Text>
            <Text style={styles.featureBig}>
              {features ? features.totalSignaledToday : '—'}
            </Text>
            <Text style={styles.fieldHint}>
              {features
                ? t('owner.dashboard.queue.weekSubtitle', {
                    count: features.totalSignaledWeek,
                  })
                : '—'}
            </Text>
          </View>
        </View>
      </Card>

      <Card style={styles.featureCard}>
        <View style={styles.featureRow}>
          <View
            style={[
              styles.statIcon,
              { backgroundColor: 'rgba(255, 235, 59, 0.12)' },
            ]}
          >
            <Trophy color={colors.accent} size={22} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>
              {t('owner.dashboard.hours.label')}
            </Text>
            <Text style={styles.featureBig}>
              {features
                ? `${features.salonsWithHours} / ${features.totalSalons}`
                : '—'}
            </Text>
            <Text style={styles.fieldHint}>
              {t('owner.dashboard.hours.hint')}
            </Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

function Stat({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: typeof Store;
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

const styles = StyleSheet.create({
  welcome: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  planCard: {
    marginBottom: spacing.lg,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  planName: {
    ...typography.h3,
    color: colors.text,
  },
  planMeta: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
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
  fieldHint: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  topSalonCard: {
    marginTop: spacing.md,
  },
  topSalonName: {
    ...typography.h2,
    color: colors.accent,
    marginTop: 2,
  },
  featuresTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  featureCard: {
    marginBottom: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureBig: {
    ...typography.h2,
    color: colors.text,
    marginTop: 2,
  },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, BarChart3 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { BarberAvatar } from '@/components/BarberAvatar';
import { useApp } from '@/contexts/AppContext';
import { subscribeBarbers } from '@/services/barbers';
import { subscribeSalonCuts } from '@/services/cuts';
import { formatPrice } from '@/utils/currency';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Barber, BarberPeriodStats, Cut, StatsPeriod } from '@/types';

const PERIODS: { key: StatsPeriod; tKey: string }[] = [
  { key: 'today', tKey: 'salon.barberStats.period.today' },
  { key: 'week', tKey: 'salon.barberStats.period.week' },
  { key: 'month', tKey: 'salon.barberStats.period.month' },
  { key: 'all', tKey: 'salon.barberStats.period.all' },
];

function periodStart(period: StatsPeriod): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  switch (period) {
    case 'today':
      return d.getTime();
    case 'week': {
      const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
      d.setDate(d.getDate() - day);
      return d.getTime();
    }
    case 'month':
      d.setDate(1);
      return d.getTime();
    case 'all':
      return 0;
  }
}

export function SalonBarberStatsScreen() {
  const nav = useNavigation<any>();
  const { salonId } = useApp();
  const { t } = useT();
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);

  useEffect(() => {
    if (!salonId) return;
    const unsubB = subscribeBarbers(salonId, setBarbers);
    const unsubC = subscribeSalonCuts(salonId, setCuts);
    return () => {
      unsubB();
      unsubC();
    };
  }, [salonId]);

  const stats: BarberPeriodStats[] = useMemo(() => {
    const since = periodStart(period);
    const filtered = cuts.filter((c) => c.createdAt >= since && c.barberId);
    return barbers.map((b) => {
      const list = filtered.filter((c) => c.barberId === b.id);
      const cutCount = list.length;
      const rewardCount = list.filter((c) => c.wasReward).length;
      const totalAmount = list.reduce((sum, c) => sum + (c.price || 0), 0);
      return { barber: b, cutCount, rewardCount, totalAmount };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [barbers, cuts, period]);

  const grandTotal = stats.reduce((s, x) => s + x.totalAmount, 0);
  const totalCuts = stats.reduce((s, x) => s + x.cutCount, 0);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('salon.barberStats.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[styles.periodChip, active && styles.periodChipActive]}
            >
              <Text
                style={[styles.periodLabel, active && styles.periodLabelActive]}
              >
                {t(p.tKey as any)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.summaryCard} elevated>
        <Text style={styles.summaryLabel}>
          {t('salon.barberStats.totalLabel', { period: t(`salon.barberStats.periodLong.${period}` as any) })}
        </Text>
        <Text style={styles.summaryValue}>{formatPrice(grandTotal)}</Text>
        <Text style={styles.summarySub}>
          {t(totalCuts > 1 ? 'salon.barberStats.recordedCountPlural' : 'salon.barberStats.recordedCount', { count: totalCuts })}
        </Text>
      </Card>

      {stats.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <BarChart3 color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>{t('salon.barberStats.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('salon.barberStats.empty.text')}</Text>
        </View>
      ) : (
        <FlatList
          data={stats}
          keyExtractor={(s) => s.barber.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item, index }) => (
            <BarberStatRow stats={item} rank={index + 1} t={t} />
          )}
        />
      )}
    </Screen>
  );
}

function BarberStatRow({
  stats,
  rank,
  t,
}: {
  stats: BarberPeriodStats;
  rank: number;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.rank}>
          <Text style={styles.rankText}>#{rank}</Text>
        </View>
        <BarberAvatar barber={stats.barber} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{stats.barber.name}</Text>
          <Text style={styles.meta}>
            {t(stats.cutCount > 1 ? 'salon.barberStats.cutsCountPlural' : 'salon.barberStats.cutsCount', { count: stats.cutCount })}
            {stats.rewardCount > 0 &&
              ` · ${t(stats.rewardCount > 1 ? 'salon.barberStats.rewardsCountPlural' : 'salon.barberStats.rewardsCount', { count: stats.rewardCount })}`}
          </Text>
        </View>
        <Text style={styles.amount}>{formatPrice(stats.totalAmount)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  periodChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  periodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
  },
  periodLabelActive: {
    color: colors.black,
  },
  summaryCard: {
    margin: spacing.lg,
    marginTop: 0,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -1,
  },
  summarySub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rank: {
    width: 30,
  },
  rankText: {
    ...typography.bodyBold,
    color: colors.textMuted,
    fontSize: 13,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  amount: {
    ...typography.h3,
    color: colors.primary,
  },
});

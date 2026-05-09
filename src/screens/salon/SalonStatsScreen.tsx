import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, Users, Star, ChevronLeft, LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { useApp } from '@/contexts/AppContext';
import { subscribeSalonStats } from '@/services/stats';
import { useNavigation } from '@react-navigation/native';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { SalonStats } from '@/types';

export function SalonStatsScreen() {
  const nav = useNavigation<any>();
  const { salonId } = useApp();
  const { t } = useT();
  const [stats, setStats] = useState<SalonStats | null>(null);

  useEffect(() => {
    if (!salonId) return;
    const unsub = subscribeSalonStats(salonId, setStats);
    return unsub;
  }, [salonId]);

  return (
    <Screen padded scroll>
      <View style={styles.topBar}>
        {nav.canGoBack() && (
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
            <ChevronLeft color={colors.text} size={22} strokeWidth={2.2} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.title}>{t('salon.stats.title')}</Text>
      <Text style={styles.subtitle}>{t('salon.stats.subtitle')}</Text>

      {!stats ? (
        <View style={styles.loading}>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.heroRow}>
            <HeroStat label={t('salon.profile.today')} value={stats.cutsToday} unit={t(stats.cutsToday > 1 ? 'salon.stats.unitCutPlural' : 'salon.stats.unitCut')} highlight />
          </View>

          <View style={styles.row}>
            <Stat label={t('salon.stats.thisWeek')} value={stats.cutsWeek} />
            <Stat label={t('salon.stats.thisMonth')} value={stats.cutsMonth} />
          </View>

          <View style={styles.row}>
            <Stat
              label={t('salon.stats.rewardsMonth')}
              value={stats.rewardsMonth}
              Icon={Gift}
            />
            <Stat
              label={t('salon.stats.totalCustomers')}
              value={stats.totalCustomers}
              Icon={Users}
            />
          </View>

          <View style={styles.row}>
            <Stat
              label={t('salon.stats.vipCustomers')}
              value={stats.vipCustomers}
              Icon={Star}
              accent
            />
          </View>
        </>
      )}
    </Screen>
  );
}

function HeroStat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
}) {
  if (highlight) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroLabel}>{label}</Text>
        <Text style={styles.heroValue}>{value}</Text>
        <Text style={styles.heroUnit}>{unit}</Text>
      </LinearGradient>
    );
  }
  return null;
}

function Stat({
  label,
  value,
  Icon,
  accent,
}: {
  label: string;
  value: number;
  Icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card style={[styles.stat, accent && styles.statAccent]} elevated>
      {Icon && (
        <Icon
          color={accent ? colors.accent : colors.primary}
          size={26}
          strokeWidth={2}
          style={{ marginBottom: 6 }}
        />
      )}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  topBar: {
    marginBottom: spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    ...typography.bodyBold,
    color: colors.text,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  loading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  heroRow: {
    marginBottom: spacing.md,
  },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroLabel: {
    ...typography.caption,
    color: colors.black,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  heroValue: {
    fontSize: 80,
    fontWeight: '800',
    color: colors.black,
    letterSpacing: -2,
    marginVertical: spacing.xs,
  },
  heroUnit: {
    ...typography.bodyBold,
    color: colors.black,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  statAccent: {
    borderColor: colors.accent,
  },
  statValue: {
    ...typography.h1,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Star, CalendarClock } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { useApp } from '@/contexts/AppContext';
import {
  subscribeSalonReservations,
  formatReservationDateTime,
} from '@/services/reservations';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Reservation, ReservationStatus } from '@/types';
import { ReservationsStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ReservationsStackParamList, 'ReservationsList'>;

type FilterKey = 'pending' | 'upcoming' | 'past';

const FILTERS: { key: FilterKey; tKey: string }[] = [
  { key: 'pending', tKey: 'salon.reservations.filter.pending' },
  { key: 'upcoming', tKey: 'salon.reservations.filter.upcoming' },
  { key: 'past', tKey: 'salon.reservations.filter.past' },
];

export function SalonReservationsScreen() {
  const nav = useNavigation<Nav>();
  const { salonId } = useApp();
  const { t } = useT();
  const [list, setList] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('pending');

  useEffect(() => {
    if (!salonId) return;
    const unsub = subscribeSalonReservations(salonId, (rows) => {
      setList(rows);
      setLoading(false);
    });
    return unsub;
  }, [salonId]);

  const filtered = useMemo(() => {
    const now = Date.now();
    let res = list;
    if (filter === 'pending') {
      res = list.filter((r) => r.status === 'pending' || r.status === 'proposed');
    } else if (filter === 'upcoming') {
      res = list.filter(
        (r) => r.status === 'confirmed' && r.scheduledFor > now,
      );
    } else {
      res = list.filter(
        (r) =>
          r.status === 'completed' ||
          r.status === 'refused' ||
          r.status === 'cancelled' ||
          (r.status === 'confirmed' && r.scheduledFor <= now),
      );
    }
    if (filter === 'pending' || filter === 'upcoming') {
      return [...res].sort((a, b) => a.scheduledFor - b.scheduledFor);
    }
    return [...res].sort((a, b) => b.scheduledFor - a.scheduledFor);
  }, [list, filter]);

  const pendingCount = list.filter((r) => r.status === 'pending').length;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('salon.reservations.title')}</Text>
        <Text style={styles.subtitle}>
          {pendingCount > 0
            ? t(pendingCount > 1 ? 'salon.reservations.pendingCountPlural' : 'salon.reservations.pendingCount', { count: pendingCount })
            : t('salon.reservations.noPending')}
        </Text>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count =
            f.key === 'pending'
              ? list.filter((r) => r.status === 'pending' || r.status === 'proposed').length
              : f.key === 'upcoming'
                ? list.filter((r) => r.status === 'confirmed' && r.scheduledFor > Date.now()).length
                : 0;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  active && styles.filterLabelActive,
                ]}
              >
                {t(f.tKey as any)}
              </Text>
              {count > 0 && f.key !== 'past' && (
                <View
                  style={[
                    styles.filterBadge,
                    active && styles.filterBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBadgeText,
                      active && styles.filterBadgeTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <CalendarClock color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>{t('salon.reservations.empty.title')}</Text>
          <Text style={styles.emptyText}>
            {filter === 'pending'
              ? t('salon.reservations.empty.pending')
              : filter === 'upcoming'
                ? t('salon.reservations.empty.upcoming')
                : t('salon.reservations.empty.past')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <ReservationRow
              reservation={item}
              onPress={() =>
                nav.navigate('ReservationDetail', { reservationId: item.id })
              }
              t={t}
            />
          )}
        />
      )}
    </Screen>
  );
}

function ReservationRow({
  reservation,
  onPress,
  t,
}: {
  reservation: Reservation;
  onPress: () => void;
  t: (key: any) => string;
}) {
  const meta = formatReservationDateTime(
    reservation.status === 'proposed'
      ? reservation.proposedFor || reservation.scheduledFor
      : reservation.scheduledFor,
  );
  const tone = statusTone(reservation.status, t);

  return (
    <Pressable onPress={onPress}>
      <Card style={[styles.card, { borderColor: tone.color }]}>
        <View style={styles.row}>
          <View>
            <Text style={[styles.rowDate]}>{meta.date}</Text>
            <Text style={styles.rowTime}>{meta.time}</Text>
          </View>
          <View style={styles.divider} />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {reservation.customerName || reservation.customerPhone}
              </Text>
            </View>
            <Text style={styles.service}>{t(`reservation.service.${reservation.service}` as any)}</Text>
            <Text style={[styles.statusText, { color: tone.color }]}>
              {tone.label}
            </Text>
          </View>
          <ChevronRight color={colors.textDim} size={18} strokeWidth={2} />
        </View>
      </Card>
    </Pressable>
  );
}

function statusTone(s: ReservationStatus, t: (key: any) => string) {
  switch (s) {
    case 'pending':
      return { color: colors.accent, label: t('reservation.status.pending') };
    case 'confirmed':
      return { color: colors.success, label: t('reservation.status.confirmed') };
    case 'refused':
      return { color: colors.danger, label: t('reservation.status.refused') };
    case 'proposed':
      return { color: colors.primary, label: t('salon.reservations.status.proposed') };
    case 'cancelled':
      return { color: colors.textDim, label: t('reservation.status.cancelled') };
    case 'completed':
      return { color: colors.textMuted, label: t('salon.reservations.status.completed') };
  }
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
  },
  filterLabelActive: { color: colors.black },
  filterBadge: {
    backgroundColor: colors.surfaceElevated,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  filterBadgeText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '800',
    fontSize: 11,
  },
  filterBadgeTextActive: { color: colors.black },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
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
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowDate: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    width: 80,
  },
  rowTime: {
    ...typography.h2,
    color: colors.text,
    width: 80,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    height: 40,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  service: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

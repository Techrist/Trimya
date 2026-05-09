import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Star, Search, ChevronRight, UsersRound } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { useApp } from '@/contexts/AppContext';
import { subscribeSalonCustomers } from '@/services/customers';
import { useT, getCurrentLocale, localeToBcp47 } from '@/i18n';
import { colors, radius, spacing, typography, REWARD_THRESHOLD } from '@/theme';
import { Customer, CustomerSort } from '@/types';
import { CustomersStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<CustomersStackParamList, 'CustomersList'>;

const SORT_OPTIONS: { key: CustomerSort; tKey: string }[] = [
  { key: 'lastVisit', tKey: 'salon.customers.sort.lastVisit' },
  { key: 'progress', tKey: 'salon.customers.sort.progress' },
  { key: 'totalCuts', tKey: 'salon.customers.sort.totalCuts' },
  { key: 'name', tKey: 'salon.customers.sort.name' },
];

export function SalonCustomersScreen() {
  const nav = useNavigation<Nav>();
  const { salonId } = useApp();
  const { t } = useT();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<CustomerSort>('lastVisit');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    const unsub = subscribeSalonCustomers(salonId, (list) => {
      setCustomers(list);
      setLoading(false);
    });
    return unsub;
  }, [salonId]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = customers;
    if (term) {
      list = list.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(term) ||
          c.phone.includes(term),
      );
    }
    const sorted = [...list].sort((a, b) => {
      if (a.vip !== b.vip) return a.vip ? -1 : 1;
      switch (sort) {
        case 'lastVisit':
          return (b.lastVisitAt || 0) - (a.lastVisitAt || 0);
        case 'progress':
          return b.currentCount - a.currentCount;
        case 'totalCuts':
          return b.totalCuts - a.totalCuts;
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
      }
    });
    return sorted;
  }, [customers, search, sort]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('salon.customers.title')}</Text>
        <Text style={styles.subtitle}>
          {t(customers.length > 1 ? 'salon.customers.countPlural' : 'salon.customers.count', { count: customers.length })}
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Search color={colors.textDim} size={18} strokeWidth={2} />
          <TextInput
            placeholder={t('salon.customers.search')}
            placeholderTextColor={colors.textDim}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => {
          const active = sort === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSort(opt.key)}
              style={[styles.sortChip, active && styles.sortChipActive]}
            >
              <Text style={[styles.sortLabel, active && styles.sortLabelActive]}>
                {t(opt.tKey as any)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <UsersRound color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>
            {search ? t('salon.customers.empty.noResults') : t('salon.customers.empty.title')}
          </Text>
          <Text style={styles.emptyText}>
            {search
              ? t('salon.customers.empty.noResultsHint')
              : t('salon.customers.empty.text')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <CustomerRow
              customer={item}
              onPress={() =>
                nav.navigate('CustomerDetail', { customerId: item.id })
              }
              t={t}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </Screen>
  );
}

function CustomerRow({
  customer,
  onPress,
  t,
}: {
  customer: Customer;
  onPress: () => void;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  const bcp47 = localeToBcp47(getCurrentLocale());
  const lastVisit = customer.lastVisitAt
    ? new Date(customer.lastVisitAt).toLocaleDateString(bcp47, {
        day: '2-digit',
        month: 'short',
      })
    : t('salon.customers.row.never');

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={styles.row}>
          <Avatar name={customer.name} photo={customer.photo} size={48} />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{customer.name || t('salon.customers.row.noName')}</Text>
              {customer.vip && (
                <View style={styles.vipBadge}>
                  <Star
                    color={colors.accent}
                    size={12}
                    strokeWidth={2.5}
                    fill={colors.accent}
                  />
                  <Text style={styles.vipBadgeText}>{t('salon.customer.vipBadge')}</Text>
                </View>
              )}
            </View>
            <Text style={styles.phone}>{customer.phone}</Text>
            <Text style={styles.meta}>
              {t(customer.totalCuts > 1 ? 'salon.customers.row.lastVisitPlural' : 'salon.customers.row.lastVisit', {
                date: lastVisit,
                count: customer.totalCuts,
              })}
            </Text>
          </View>
          <View style={styles.progressTag}>
            <Text style={styles.progressText}>
              {Math.min(customer.currentCount, REWARD_THRESHOLD)}/{REWARD_THRESHOLD}
            </Text>
          </View>
          <ChevronRight color={colors.textDim} size={18} strokeWidth={2} />
        </View>
      </Card>
    </Pressable>
  );
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
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.md,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sortLabelActive: {
    color: colors.black,
  },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h3,
    color: colors.primary,
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
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 235, 59, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  vipBadgeText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  phone: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  meta: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  progressTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressText: {
    ...typography.bodyBold,
    color: colors.text,
  },
});

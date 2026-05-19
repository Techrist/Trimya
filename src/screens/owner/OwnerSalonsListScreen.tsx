import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Store, ChevronRight, Ban, CheckCircle2, Clock } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { useOwner } from '@/hooks/useOwner';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Salon } from '@/types';
import { PLANS } from '@/lib/plans';
import { OwnerSalonsStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerSalonsStackParamList, 'OwnerSalonsList'>;

export function OwnerSalonsListScreen() {
  const nav = useNavigation<Nav>();
  const { ownerId } = useApp();
  const { salons, owner, loading } = useOwner(ownerId);
  const { t } = useT();

  const limit = PLANS.enterprise.limits.maxSalons ?? 5;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('owner.salons.title')}</Text>
        <Text style={styles.subtitle}>
          {t('owner.salons.countOfMax', { count: salons.length, max: limit })}
        </Text>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : salons.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Store color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>{t('owner.salons.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('owner.salons.empty.text')}</Text>
        </View>
      ) : (
        <FlatList
          data={salons}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => nav.navigate('OwnerSalonDetail', { salonId: item.id })}
            >
              <Card>
                <View style={styles.row}>
                  <View style={styles.iconWrap}>
                    <Store color={colors.primary} size={22} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>{item.city}</Text>
                    <View style={styles.statusRow}>
                      <StatusBadge salon={item} t={t} />
                    </View>
                  </View>
                  <ChevronRight color={colors.textDim} size={20} strokeWidth={2} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

function StatusBadge({ salon, t }: { salon: Salon; t: (key: any, vars?: any) => string }) {
  if (salon.disabledAt) {
    return (
      <View style={[styles.badge, styles.badgeDanger]}>
        <Ban color={colors.danger} size={12} strokeWidth={2.4} />
        <Text style={[styles.badgeText, { color: colors.danger }]}>
          {t('owner.salons.status.disabled')}
        </Text>
      </View>
    );
  }
  if (salon.activatedAt && salon.activatedAt > 0) {
    return (
      <View style={[styles.badge, styles.badgeSuccess]}>
        <CheckCircle2 color={colors.success} size={12} strokeWidth={2.4} />
        <Text style={[styles.badgeText, { color: colors.success }]}>
          {t('owner.salons.status.activated')}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgeMuted]}>
      <Clock color={colors.textMuted} size={12} strokeWidth={2.4} />
      <Text style={[styles.badgeText, { color: colors.textMuted }]}>
        {t('owner.salons.status.pending')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
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
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
  statusRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badgeDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  badgeMuted: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
});

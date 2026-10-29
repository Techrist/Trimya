import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Home,
  ChevronRight,
  Clock,
  CheckCircle2,
  X,
  AlertTriangle,
  MapPin,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { LockedFeature } from '@/components/LockedFeature';
import { useApp } from '@/contexts/AppContext';
import { useSalonPlan } from '@/hooks/useSalonPlan';
import {
  subscribeSalonHomeRequests,
  formatHomeRequestDateTime,
} from '@/services/homeServiceRequests';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { HomeServiceRequest, HomeServiceStatus } from '@/types';

/**
 * Inbox des demandes domicile côté salon (kiosque tablette).
 * Pending en haut (action requise), puis le reste par date décroissante.
 */
export function SalonHomeRequestsScreen() {
  const nav = useNavigation<any>();
  const { salonId } = useApp();
  const { t } = useT();
  const { limits, loading: planLoading } = useSalonPlan(salonId);
  const [list, setList] = useState<HomeServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    const unsub = subscribeSalonHomeRequests(salonId, (rows) => {
      setList(rows);
      setLoading(false);
    });
    return unsub;
  }, [salonId]);

  // Service à domicile est gating Pro (cf. Firestore rules + product decision).
  // On utilise `reservations` comme proxy car les 2 features sont sur le même
  // tier (Pro). Si on veut séparer un jour : ajouter `homeService` dans
  // PlanLimits.
  if (planLoading) {
    return (
      <Screen centered>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (!limits.reservations) {
    return (
      <LockedFeature
        requiredPlan="pro"
        title={t('salon.homeRequests.lockedTitle')}
        body={t('salon.homeRequests.lockedText')}
      />
    );
  }

  const pendingCount = list.filter((r) => r.status === 'pending').length;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('salon.homeRequests.title')}</Text>
        <Text style={styles.subtitle}>
          {pendingCount > 0
            ? t(pendingCount > 1
                ? 'salon.homeRequests.pendingCountPlural'
                : 'salon.homeRequests.pendingCount', { count: pendingCount })
            : t('salon.homeRequests.noPending')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.iconWrap}>
            <Home color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>
            {t('salon.homeRequests.empty.title')}
          </Text>
          <Text style={styles.emptyText}>
            {t('salon.homeRequests.empty.text')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                nav.navigate('SalonHomeRequestAction', { requestId: item.id })
              }
            >
              <RequestRow req={item} t={t} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

function RequestRow({ req, t }: { req: HomeServiceRequest; t: any }) {
  const dt = formatHomeRequestDateTime(req.requestedFor);
  const palette = {
    pending: { color: colors.accent, icon: Clock },
    confirmed: { color: colors.success, icon: CheckCircle2 },
    proposed: { color: colors.primary, icon: AlertTriangle },
    refused: { color: colors.danger, icon: X },
    cancelled: { color: colors.textDim, icon: X },
    completed: { color: colors.success, icon: CheckCircle2 },
  }[req.status as HomeServiceStatus];
  const Icon = palette.icon;
  return (
    <Card
      style={
        req.status === 'pending'
          ? { borderColor: colors.accent, borderWidth: 1.5 }
          : undefined
      }
    >
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Home color={colors.primary} size={18} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerName}>
            {req.customerName || req.customerPhone}
          </Text>
          <View style={styles.metaLine}>
            <Clock color={colors.textDim} size={12} strokeWidth={2} />
            <Text style={styles.meta}>{dt.full}</Text>
          </View>
          <View style={styles.metaLine}>
            <MapPin color={colors.textDim} size={12} strokeWidth={2} />
            <Text style={styles.meta} numberOfLines={1}>
              {req.address}
            </Text>
          </View>
          <Text style={styles.barberName}>
            {t('salon.homeRequests.requestedBarber', { name: req.barberName })}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                borderColor: palette.color,
                backgroundColor: `${palette.color}1A`,
              },
            ]}
          >
            <Icon color={palette.color} size={11} strokeWidth={2.4} />
            <Text style={[styles.statusText, { color: palette.color }]}>
              {t(`home.status.${req.status}`)}
            </Text>
          </View>
        </View>
        <ChevronRight color={colors.textDim} size={18} strokeWidth={2} />
      </View>
    </Card>
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
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  barberName: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

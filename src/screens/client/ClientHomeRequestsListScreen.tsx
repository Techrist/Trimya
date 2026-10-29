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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Clock,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { storage } from '@/services/storage';
import {
  subscribeCustomerHomeRequests,
  formatHomeRequestDateTime,
} from '@/services/homeServiceRequests';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { HomeServiceRequest, HomeServiceStatus } from '@/types';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientHomeRequestsList'>;

export function ClientHomeRequestsListScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [list, setList] = useState<HomeServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) {
        setLoading(false);
        return;
      }
      unsub = subscribeCustomerHomeRequests(id, (rows) => {
        setList(rows);
        setLoading(false);
      });
    })();
    return () => unsub?.();
  }, []);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('client.homeRequestsList.title')}
        </Text>
        <View style={{ width: 40 }} />
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
            {t('client.homeRequestsList.empty.title')}
          </Text>
          <Text style={styles.emptyText}>
            {t('client.homeRequestsList.empty.text')}
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
                nav.navigate('ClientHomeRequestDetail', { requestId: item.id })
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
  const statusPalette = {
    pending: { color: colors.accent, icon: Clock },
    confirmed: { color: colors.success, icon: CheckCircle2 },
    proposed: { color: colors.primary, icon: AlertTriangle },
    refused: { color: colors.danger, icon: X },
    cancelled: { color: colors.textDim, icon: X },
    completed: { color: colors.success, icon: CheckCircle2 },
  }[req.status as HomeServiceStatus];
  const Icon = statusPalette.icon;
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.barberWrap}>
          <Home color={colors.primary} size={20} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.barberName}>{req.barberName}</Text>
          <Text style={styles.dateTime}>{dt.full}</Text>
          <Text style={styles.address} numberOfLines={1}>
            {req.address}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                borderColor: statusPalette.color,
                backgroundColor: `${statusPalette.color}1A`,
              },
            ]}
          >
            <Icon color={statusPalette.color} size={11} strokeWidth={2.4} />
            <Text style={[styles.statusText, { color: statusPalette.color }]}>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
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
  barberWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barberName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  dateTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  address: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
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

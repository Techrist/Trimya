import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  Footprints,
  CheckCircle2,
  X,
  Star,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { LockedFeature } from '@/components/LockedFeature';
import { useApp } from '@/contexts/AppContext';
import { useSalonPlan } from '@/hooks/useSalonPlan';
import {
  cancelQueueEntry,
  formatEta,
  markQueueEntryArrived,
  subscribeSalonQueue,
} from '@/services/queue';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { QueueEntry } from '@/types';
import { ScannerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ScannerStackParamList, 'Queue'>;

/**
 * File d'attente "Je suis en route" côté salon.
 *
 * Liste live des clients qui ont signalé leur arrivée imminente.
 * Permet de marquer un client comme "Arrivé" (entre dans le salon)
 * ou d'annuler une entrée (no-show / erreur).
 */
export function SalonQueueScreen() {
  const nav = useNavigation<Nav>();
  const { salonId } = useApp();
  const { t } = useT();
  const { limits, loading: planLoading } = useSalonPlan(salonId);
  const [list, setList] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId || !limits.queueSignal) {
      setLoading(false);
      return;
    }
    const unsub = subscribeSalonQueue(salonId, (rows) => {
      setList(rows);
      setLoading(false);
    });
    return unsub;
  }, [salonId, limits.queueSignal]);

  // Hooks au-dessus, retour anticipé en dessous (Rules of Hooks).
  if (!planLoading && !limits.queueSignal) {
    return <LockedFeature requiredPlan="standard" />;
  }

  const signaled = list.filter((e) => e.status === 'signaled');
  const arrivedRecent = list.filter((e) => e.status === 'arrived');

  const handleArrived = async (entry: QueueEntry) => {
    try {
      await markQueueEntryArrived(entry.id);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || String(e));
    }
  };

  const handleCancel = (entry: QueueEntry) => {
    Alert.alert(
      t('queue.salon.cancelConfirmTitle'),
      t('queue.salon.cancelConfirmText', {
        name: entry.customerName?.trim() || entry.customerPhone,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('queue.salon.cancelConfirmCta'),
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelQueueEntry(entry.id, 'salon');
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message || String(e));
            }
          },
        },
      ],
    );
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('queue.salon.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.subheader}>
        <Footprints color={colors.primary} size={18} strokeWidth={2.2} />
        <Text style={styles.subheaderText}>
          {signaled.length > 0
            ? t(
                signaled.length > 1
                  ? 'queue.salon.activeCountPlural'
                  : 'queue.salon.activeCount',
                { count: signaled.length },
              )
            : t('queue.salon.noActive')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Footprints color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>{t('queue.salon.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('queue.salon.empty.text')}</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            signaled.length > 0 ? (
              <Text style={styles.sectionLabel}>
                {t('queue.salon.section.signaled')}
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => {
            const showArrivedHeader =
              item.status === 'arrived' &&
              (index === 0 || list[index - 1].status !== 'arrived');
            return (
              <>
                {showArrivedHeader ? (
                  <Text
                    style={[
                      styles.sectionLabel,
                      { marginTop: spacing.lg },
                    ]}
                  >
                    {t('queue.salon.section.arrived')}
                  </Text>
                ) : null}
                <QueueRow
                  entry={item}
                  onArrived={() => handleArrived(item)}
                  onCancel={() => handleCancel(item)}
                />
              </>
            );
          }}
        />
      )}

      <View style={{ height: arrivedRecent.length === 0 ? 0 : spacing.lg }} />
    </Screen>
  );
}

function QueueRow({
  entry,
  onArrived,
  onCancel,
}: {
  entry: QueueEntry;
  onArrived: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const isActive = entry.status === 'signaled';
  const expectedTime = new Date(entry.expectedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const arrivedTime = entry.arrivedAt
    ? new Date(entry.arrivedAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const minutesUntil = Math.round((entry.expectedAt - Date.now()) / 60000);
  const isLate = isActive && minutesUntil < -5;
  const isImminent = isActive && minutesUntil <= 5 && minutesUntil >= -5;

  // Card.style accepte un seul ViewStyle — on aplatit pour éviter le mismatch.
  const cardStyle = {
    ...styles.card,
    ...(isActive && isLate ? styles.cardLate : {}),
    ...(isActive && !isLate && isImminent ? styles.cardImminent : {}),
  };

  return (
    <Card style={cardStyle}>
      <View style={styles.row}>
        <View style={styles.etaCol}>
          <Text
            style={[
              styles.etaValue,
              isLate && { color: colors.danger },
              isImminent && { color: colors.primary },
            ]}
          >
            {formatEta(entry.etaMinutes)}
          </Text>
          <Text style={styles.etaLabel}>
            {isActive ? expectedTime : arrivedTime}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {entry.customerName?.trim() || entry.customerPhone}
            </Text>
            {entry.customerVip ? (
              <Star
                color={colors.accent}
                size={14}
                strokeWidth={2.4}
                fill={colors.accent}
              />
            ) : null}
          </View>
          <Text style={styles.phone}>{entry.customerPhone}</Text>
          <Text
            style={[
              styles.statusText,
              {
                color: isActive
                  ? isLate
                    ? colors.danger
                    : isImminent
                      ? colors.primary
                      : colors.textMuted
                  : colors.success,
              },
            ]}
          >
            {isActive
              ? isLate
                ? t('queue.salon.statusLate', {
                    minutes: Math.abs(minutesUntil),
                  })
                : isImminent
                  ? t('queue.salon.statusImminent')
                  : t('queue.salon.statusOnWay')
              : t('queue.salon.statusArrived')}
          </Text>
        </View>
      </View>

      {isActive ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onArrived}
            style={[styles.actionBtn, styles.actionBtnPrimary]}
          >
            <CheckCircle2 color={colors.black} size={16} strokeWidth={2.4} />
            <Text style={[styles.actionBtnText, { color: colors.black }]}>
              {t('queue.salon.arrived')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            style={[styles.actionBtn, styles.actionBtnGhost]}
          >
            <X color={colors.textMuted} size={16} strokeWidth={2.2} />
            <Text style={styles.actionBtnText}>{t('queue.salon.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}
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
  subheader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  subheaderText: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
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
    borderColor: colors.border,
  },
  cardImminent: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  cardLate: {
    borderColor: colors.danger,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  etaCol: {
    width: 70,
    alignItems: 'center',
  },
  etaValue: {
    ...typography.h2,
    color: colors.text,
  },
  etaLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    height: 50,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  phone: {
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionBtnGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  actionBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text,
  },
});

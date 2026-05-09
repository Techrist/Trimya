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
import { Plus, Check, X, Clock, CalendarPlus } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { storage } from '@/services/storage';
import { getCustomer } from '@/services/customers';
import {
  subscribeCustomerReservations,
  updateReservationStatus,
  formatReservationDateTime,
} from '@/services/reservations';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Reservation, ReservationStatus } from '@/types';
import { ReservationsStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ReservationsStackParamList, 'ReservationsList'>;

export function ClientReservationsScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [list, setList] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) {
        setLoading(false);
        return;
      }
      unsub = subscribeCustomerReservations(id, (rows) => {
        setList(rows);
        setLoading(false);
      });
    })();
    return () => unsub?.();
  }, []);

  const handleAcceptProposal = (r: Reservation) => {
    Alert.alert(
      t('client.reservation.acceptProposalTitle'),
      t('client.reservation.acceptProposalConfirm', {
        when: formatReservationDateTime(r.proposedFor || r.scheduledFor).full,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            await updateReservationStatus({
              reservation: r,
              status: 'confirmed',
              by: 'customer',
            });
          },
        },
      ],
    );
  };

  const handleCancelProposal = (r: Reservation) => {
    Alert.alert(
      t('client.reservation.refuseProposalTitle'),
      t('client.reservation.refuseProposalText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.refuse'),
          style: 'destructive',
          onPress: async () => {
            await updateReservationStatus({
              reservation: r,
              status: 'cancelled',
              by: 'customer',
            });
          },
        },
      ],
    );
  };

  const handleCancel = (r: Reservation) => {
    Alert.alert(t('client.reservation.cancelTitle'), t('client.reservation.cancelText'), [
      { text: t('client.reservation.keep'), style: 'cancel' },
      {
        text: t('common.cancel'),
        style: 'destructive',
        onPress: async () => {
          await updateReservationStatus({
            reservation: r,
            status: 'cancelled',
            by: 'customer',
          });
        },
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('client.reservations.title')}</Text>
        <Text style={styles.subtitle}>
          {t(list.length > 1 ? 'client.reservations.requestsPlural' : 'client.reservations.requests', { count: list.length })}
        </Text>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <CalendarPlus color={colors.textDim} size={36} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>{t('client.reservations.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('client.reservations.empty.text')}</Text>
          <View style={{ height: spacing.lg }} />
          <Button
            label={t('client.reservations.bookNow')}
            onPress={() => nav.navigate('ReservationForm')}
            fullWidth={false}
          />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <ReservationRow
              reservation={item}
              onAcceptProposal={() => handleAcceptProposal(item)}
              onRefuseProposal={() => handleCancelProposal(item)}
              onCancel={() => handleCancel(item)}
              t={t}
            />
          )}
        />
      )}

      {!loading && list.length > 0 && (
        <Pressable
          onPress={() => nav.navigate('ReservationForm')}
          style={styles.fab}
        >
          <Plus color={colors.black} size={24} strokeWidth={2.6} />
        </Pressable>
      )}
    </Screen>
  );
}

function ReservationRow({
  reservation,
  onAcceptProposal,
  onRefuseProposal,
  onCancel,
  t,
}: {
  reservation: Reservation;
  onAcceptProposal: () => void;
  onRefuseProposal: () => void;
  onCancel: () => void;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  const meta = formatReservationDateTime(
    reservation.status === 'proposed'
      ? reservation.proposedFor || reservation.scheduledFor
      : reservation.scheduledFor,
  );
  const tone = statusTone(reservation.status, t);

  return (
    <Card style={[styles.card, { borderColor: tone.color }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
        <Text style={[styles.statusText, { color: tone.color }]}>
          {tone.label}
        </Text>
      </View>

      <Text style={styles.dateText}>{meta.date}</Text>
      <Text style={styles.timeText}>{meta.time}</Text>
      <Text style={styles.serviceText}>{t(`reservation.service.${reservation.service}`)}</Text>

      {reservation.note ? (
        <Text style={styles.noteText} numberOfLines={2}>
          « {reservation.note} »
        </Text>
      ) : null}

      {reservation.status === 'proposed' && (
        <View style={styles.proposedBox}>
          <Text style={styles.proposedTitle}>
            {t('reservation.status.proposed')}
          </Text>
          {reservation.scheduledFor !== reservation.proposedFor && (
            <Text style={styles.proposedHint}>
              ({formatReservationDateTime(reservation.scheduledFor).full})
            </Text>
          )}
          {reservation.proposedNote && (
            <Text style={styles.proposedNote}>« {reservation.proposedNote} »</Text>
          )}
          <View style={styles.actions}>
            <Pressable onPress={onRefuseProposal} style={[styles.actionBtn, styles.actionBtnGhost]}>
              <X color={colors.danger} size={16} strokeWidth={2.4} />
              <Text style={[styles.actionText, { color: colors.danger }]}>{t('common.refuse')}</Text>
            </Pressable>
            <Pressable onPress={onAcceptProposal} style={[styles.actionBtn, styles.actionBtnPrimary]}>
              <Check color={colors.black} size={16} strokeWidth={2.6} />
              <Text style={[styles.actionText, { color: colors.black }]}>{t('common.accept')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {reservation.status === 'refused' && reservation.refusedReason ? (
        <Text style={styles.refusedReason}>« {reservation.refusedReason} »</Text>
      ) : null}

      {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
        <Pressable onPress={onCancel} style={styles.cancelLink}>
          <Text style={styles.cancelLinkText}>{t('common.cancel')}</Text>
        </Pressable>
      )}
    </Card>
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
      return { color: colors.primary, label: t('reservation.status.proposed') };
    case 'cancelled':
      return { color: colors.textDim, label: t('reservation.status.cancelled') };
    case 'completed':
      return { color: colors.textMuted, label: t('reservation.status.completed') };
  }
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
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
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
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dateText: {
    ...typography.h3,
    color: colors.text,
    textTransform: 'capitalize',
  },
  timeText: {
    ...typography.h2,
    color: colors.primary,
    marginTop: 2,
  },
  serviceText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  noteText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  proposedBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  proposedTitle: {
    ...typography.bodyBold,
    color: colors.primary,
    marginBottom: 4,
  },
  proposedHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  proposedNote: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.sm,
    fontStyle: 'italic',
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
    borderRadius: radius.md,
  },
  actionBtnGhost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionText: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  refusedReason: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  cancelLink: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  cancelLinkText: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});

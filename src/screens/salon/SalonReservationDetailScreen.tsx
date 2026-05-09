import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Check, X, RefreshCcw, Star } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import {
  getReservation,
  updateReservationStatus,
  formatReservationDateTime,
} from '@/services/reservations';
import { getCustomer } from '@/services/customers';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Customer, Reservation } from '@/types';
import { ReservationsStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ReservationsStackParamList, 'ReservationDetail'>;
type Rt = RouteProp<ReservationsStackParamList, 'ReservationDetail'>;

export function SalonReservationDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { reservationId } = route.params;
  const { t } = useT();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const r = await getReservation(reservationId);
    setReservation(r);
    if (r) {
      const c = await getCustomer(r.customerId);
      setCustomer(c);
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, [reservationId]);

  // Refresh when coming back from Propose/Refuse screens
  useFocusEffect(
    React.useCallback(() => {
      reload();
    }, [reservationId]),
  );

  const handleAccept = async () => {
    if (!reservation || !customer) return;
    try {
      await updateReservationStatus({
        reservation,
        status: 'confirmed',
        by: 'salon',
        customer,
      });
      await reload();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('salon.reservation.errorAction'));
    }
  };

  if (loading) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  if (!reservation) {
    return (
      <Screen padded centered>
        <Text style={typography.h2 as any}>{t('salon.reservation.notFound')}</Text>
        <Button label={t('common.back')} onPress={() => nav.goBack()} />
      </Screen>
    );
  }

  const meta = formatReservationDateTime(reservation.scheduledFor);
  const propMeta = reservation.proposedFor
    ? formatReservationDateTime(reservation.proposedFor)
    : null;
  const isPending = reservation.status === 'pending';
  const isPastConfirmed =
    reservation.status === 'confirmed' &&
    reservation.scheduledFor < Date.now();

  const handleMarkHonored = async () => {
    if (!reservation || !customer) return;
    try {
      await updateReservationStatus({
        reservation,
        status: 'completed',
        by: 'salon',
        customer,
      });
      await reload();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('salon.reservation.errorAction'));
    }
  };

  const handleMarkNoShow = async () => {
    Alert.alert(
      t('salon.reservation.noShowTitle'),
      t('salon.reservation.noShowText'),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('salon.reservation.noShowConfirm'),
          style: 'destructive',
          onPress: async () => {
            if (!reservation || !customer) return;
            await updateReservationStatus({
              reservation,
              status: 'cancelled',
              by: 'salon',
              customer,
            });
            await reload();
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
        <Text style={styles.headerTitle}>{t('salon.reservation.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard} elevated>
          <Text style={styles.heroDate}>{meta.date}</Text>
          <Text style={styles.heroTime}>{meta.time}</Text>
          <Text style={styles.heroService}>{t(`reservation.service.${reservation.service}` as any)}</Text>
          {propMeta && (
            <View style={styles.proposedTag}>
              <Text style={styles.proposedTagText}>
                {t('salon.reservation.proposing', { date: propMeta.date, time: propMeta.time })}
              </Text>
            </View>
          )}
        </Card>

        <Text style={styles.sectionTitle}>{t('salon.reservation.client')}</Text>
        <Card>
          <View style={styles.customerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(reservation.customerName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.customerName}>
                  {reservation.customerName || t('salon.reservation.client')}
                </Text>
                {customer?.vip && (
                  <Star
                    color={colors.accent}
                    size={14}
                    strokeWidth={2.2}
                    fill={colors.accent}
                  />
                )}
              </View>
              <Text style={styles.customerPhone}>{reservation.customerPhone}</Text>
            </View>
          </View>
        </Card>

        {reservation.note ? (
          <>
            <Text style={styles.sectionTitle}>{t('salon.reservation.clientNote')}</Text>
            <Card>
              <Text style={styles.note}>« {reservation.note} »</Text>
            </Card>
          </>
        ) : null}

        {reservation.status === 'refused' && reservation.refusedReason ? (
          <>
            <Text style={styles.sectionTitle}>{t('salon.reservation.refusedReason')}</Text>
            <Card>
              <Text style={styles.note}>« {reservation.refusedReason} »</Text>
            </Card>
          </>
        ) : null}

        {isPastConfirmed && (
          <View style={styles.actions}>
            <Pressable
              onPress={handleMarkHonored}
              style={[styles.action, styles.actionPrimary]}
            >
              <Check color={colors.black} size={20} strokeWidth={2.6} />
              <Text style={[styles.actionText, { color: colors.black }]}>
                {t('salon.reservation.markHonored')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleMarkNoShow}
              style={[styles.action, styles.actionDanger]}
            >
              <X color={colors.danger} size={18} strokeWidth={2.4} />
              <Text style={[styles.actionText, { color: colors.danger }]}>
                {t('salon.reservation.markNoShow')}
              </Text>
            </Pressable>
          </View>
        )}

        {isPending && (
          <View style={styles.actions}>
            <Pressable
              onPress={handleAccept}
              style={[styles.action, styles.actionPrimary]}
            >
              <Check color={colors.black} size={20} strokeWidth={2.6} />
              <Text style={[styles.actionText, { color: colors.black }]}>
                {t('common.accept')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                nav.navigate('ProposeReservation', { reservationId })
              }
              style={[styles.action, styles.actionSecondary]}
            >
              <RefreshCcw color={colors.primary} size={18} strokeWidth={2.4} />
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {t('salon.reservation.proposeOther')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                nav.navigate('RefuseReservation', { reservationId })
              }
              style={[styles.action, styles.actionDanger]}
            >
              <X color={colors.danger} size={18} strokeWidth={2.4} />
              <Text style={[styles.actionText, { color: colors.danger }]}>
                {t('common.refuse')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
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
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    alignItems: 'center',
  },
  heroDate: {
    ...typography.h3,
    color: colors.text,
    textTransform: 'capitalize',
  },
  heroTime: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
    marginVertical: spacing.xs,
    letterSpacing: -1,
  },
  heroService: {
    ...typography.body,
    color: colors.textMuted,
  },
  proposedTag: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  proposedTagText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  customerRow: {
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
  customerName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  customerPhone: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  note: {
    ...typography.body,
    color: colors.text,
    fontStyle: 'italic',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  actionPrimary: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  actionSecondary: {
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
    borderColor: colors.primary,
  },
  actionDanger: {
    backgroundColor: 'transparent',
    borderColor: colors.danger,
  },
  actionText: {
    ...typography.button,
    fontSize: 15,
  },
});

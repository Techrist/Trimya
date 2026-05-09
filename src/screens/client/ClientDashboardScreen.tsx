import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  QrCode,
  CalendarDays,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { Card } from '@/components/Card';
import { Logo } from '@/components/Logo';
import { storage } from '@/services/storage';
import { subscribeCustomer } from '@/services/customers';
import { subscribeCustomerReservations, formatReservationDateTime, serviceLabel } from '@/services/reservations';
import { notifyRewardUnlocked } from '@/services/notifications';
import { registerPushTokenForCustomer } from '@/services/push';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography, REWARD_THRESHOLD } from '@/theme';
import { Customer, Reservation } from '@/types';

export function ClientDashboardScreen() {
  const nav = useNavigation<any>();
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextReservation, setNextReservation] = useState<Reservation | null>(null);
  const lastNotifiedCount = useRef<number | null>(null);

  useEffect(() => {
    let unsubCustomer: (() => void) | undefined;
    let unsubReservations: (() => void) | undefined;
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) {
        setLoading(false);
        return;
      }
      registerPushTokenForCustomer(id);

      unsubCustomer = subscribeCustomer(id, (c) => {
        setCustomer(c);
        setLoading(false);

        if (
          c &&
          c.currentCount === REWARD_THRESHOLD &&
          lastNotifiedCount.current !== c.currentCount
        ) {
          lastNotifiedCount.current = c.currentCount;
          notifyRewardUnlocked();
        }
        if (c && c.currentCount !== REWARD_THRESHOLD) {
          lastNotifiedCount.current = c.currentCount;
        }
      });

      unsubReservations = subscribeCustomerReservations(id, (list) => {
        const now = Date.now();
        const upcoming = list
          .filter(
            (r) =>
              (r.status === 'confirmed' || r.status === 'pending' || r.status === 'proposed') &&
              (r.proposedFor || r.scheduledFor) >= now,
          )
          .sort(
            (a, b) =>
              (a.proposedFor || a.scheduledFor) - (b.proposedFor || b.scheduledFor),
          );
        setNextReservation(upcoming[0] || null);
      });
    })();
    return () => {
      unsubCustomer?.();
      unsubReservations?.();
    };
  }, []);

  if (loading) {
    return (
      <Screen centered>
        <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
      </Screen>
    );
  }

  if (!customer) {
    return (
      <Screen padded centered>
        <Text style={styles.errTitle}>{t('client.dashboard.accountNotFound')}</Text>
        <Text style={styles.errText}>{t('client.dashboard.accountNotFoundHint')}</Text>
      </Screen>
    );
  }

  const isReady = customer.currentCount >= REWARD_THRESHOLD;

  return (
    <Screen padded scroll>
      <View style={styles.topBar}>
        <Logo size={36} />
      </View>

      <Text style={styles.greeting}>
        {t('client.dashboard.greeting', { name: customer.name || t('client.dashboard.greetingFallback') })}
      </Text>

      <Card style={styles.progressCard} elevated>
        <ProgressIndicator count={customer.currentCount} />
      </Card>

      <View style={styles.actions}>
        <Pressable onPress={() => nav.navigate('ClientQr')}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryAction}
          >
            <QrCode color={colors.black} size={26} strokeWidth={2.2} />
            <Text style={styles.primaryActionText}>
              {isReady ? t('client.dashboard.showQrReward') : t('client.dashboard.showQr')}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => nav.navigate('ReservationsTab', { screen: 'ReservationForm' })}
          style={styles.secondaryAction}
        >
          <CalendarDays color={colors.primary} size={20} strokeWidth={2.2} />
          <Text style={styles.secondaryActionText}>{t('client.dashboard.bookSlot')}</Text>
        </Pressable>
      </View>

      {nextReservation && <NextReservationCard r={nextReservation} onPress={() => nav.navigate('ReservationsTab')} />}

      <Pressable
        onPress={() => nav.navigate('ClientHistory')}
        style={styles.historyLink}
      >
        <Clock color={colors.textMuted} size={18} strokeWidth={2} />
        <Text style={styles.historyLinkText}>{t('client.dashboard.viewHistory')}</Text>
        <ChevronRight color={colors.textDim} size={18} strokeWidth={2} />
      </Pressable>
    </Screen>
  );
}

function NextReservationCard({
  r,
  onPress,
}: {
  r: Reservation;
  onPress: () => void;
}) {
  const meta = formatReservationDateTime(
    r.status === 'proposed' ? r.proposedFor || r.scheduledFor : r.scheduledFor,
  );
  const tone =
    r.status === 'confirmed'
      ? { color: colors.success, label: 'Confirmé', Icon: CheckCircle2 }
      : r.status === 'proposed'
        ? { color: colors.primary, label: 'Contre-proposition', Icon: Clock }
        : { color: colors.accent, label: 'En attente', Icon: Clock };

  return (
    <Pressable onPress={onPress} style={{ marginTop: spacing.lg }}>
      <Card style={[{ borderColor: tone.color, borderWidth: 1.5 }]}>
        <View style={styles.nextHeader}>
          <tone.Icon color={tone.color} size={18} strokeWidth={2.2} />
          <Text style={[styles.nextLabel, { color: tone.color }]}>{tone.label}</Text>
        </View>
        <Text style={styles.nextTitle}>Mon prochain rendez-vous</Text>
        <Text style={styles.nextDate}>{meta.date}</Text>
        <Text style={styles.nextTime}>{meta.time}</Text>
        <Text style={styles.nextService}>{serviceLabel(r.service)}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  greetingName: {
    color: colors.primary,
  },
  progressCard: {
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.md,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 4,
    borderRadius: 20,
  },
  primaryActionText: {
    ...typography.button,
    color: colors.black,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  secondaryActionText: {
    ...typography.button,
    color: colors.primary,
  },
  nextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  nextLabel: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  nextTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  nextDate: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  nextTime: {
    ...typography.h2,
    color: colors.primary,
  },
  nextService: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  historyLinkText: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  errTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errText: {
    ...typography.body,
    color: colors.textMuted,
  },
});

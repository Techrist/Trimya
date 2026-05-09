import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ReservationService, RESERVATION_SERVICES } from '@/types';
import { useT, getCurrentLocale, localeToBcp47 } from '@/i18n';

/**
 * Horizontal scrollable date chips for the next N days.
 */
export function DateSlotPicker({
  value,
  onChange,
  daysAhead = 14,
}: {
  value: number;
  onChange: (ts: number) => void;
  daysAhead?: number;
}) {
  const { locale } = useT();
  const bcp47 = localeToBcp47(locale);
  const todayLabel = locale === 'en' ? 'Today' : 'Auj.';

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: daysAhead }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, [daysAhead]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dateRow}
    >
      {days.map((d) => {
        const ts = d.getTime();
        const selected = sameDay(ts, value);
        const dayName = d
          .toLocaleDateString(bcp47, { weekday: 'short' })
          .replace('.', '');
        const dayNum = d.getDate();
        const month = d.toLocaleDateString(bcp47, { month: 'short' }).replace('.', '');
        const isToday = sameDay(ts, Date.now());

        return (
          <Pressable
            key={ts}
            onPress={() => onChange(ts)}
            style={[
              styles.dateChip,
              selected && styles.dateChipActive,
            ]}
          >
            <Text
              style={[
                styles.dateChipDay,
                selected && styles.dateChipDayActive,
              ]}
            >
              {isToday ? todayLabel : dayName}
            </Text>
            <Text
              style={[
                styles.dateChipNum,
                selected && styles.dateChipNumActive,
              ]}
            >
              {dayNum}
            </Text>
            <Text
              style={[
                styles.dateChipMonth,
                selected && styles.dateChipMonthActive,
              ]}
            >
              {month}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * Grid of 30-min time slots between 9:00 and 19:00.
 */
export function TimeSlotPicker({
  date,
  value,
  onChange,
  startHour = 9,
  endHour = 19,
  minuteStep = 30,
}: {
  date: number;
  value: number | null;
  onChange: (ts: number) => void;
  startHour?: number;
  endHour?: number;
  minuteStep?: number;
}) {
  const slots = useMemo(() => {
    const base = new Date(date);
    base.setHours(0, 0, 0, 0);
    const out: number[] = [];
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += minuteStep) {
        const slot = new Date(base);
        slot.setHours(h, m, 0, 0);
        out.push(slot.getTime());
      }
    }
    return out;
  }, [date, startHour, endHour, minuteStep]);

  const now = Date.now();

  return (
    <View style={styles.timeGrid}>
      {slots.map((ts) => {
        const selected = value === ts;
        const past = ts < now;
        const label = new Date(ts).toLocaleTimeString(localeToBcp47(getCurrentLocale()), {
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <Pressable
            key={ts}
            onPress={() => !past && onChange(ts)}
            disabled={past}
            style={[
              styles.timeChip,
              selected && styles.timeChipActive,
              past && styles.timeChipDisabled,
            ]}
          >
            <Text
              style={[
                styles.timeChipText,
                selected && styles.timeChipTextActive,
                past && styles.timeChipTextDisabled,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ServicePicker({
  value,
  onChange,
}: {
  value: ReservationService;
  onChange: (s: ReservationService) => void;
}) {
  const { t } = useT();
  return (
    <View style={styles.serviceRow}>
      {RESERVATION_SERVICES.map((s) => {
        const active = value === s.key;
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(s.key)}
            style={[styles.serviceChip, active && styles.serviceChipActive]}
          >
            <Text
              style={[
                styles.serviceLabel,
                active && styles.serviceLabelActive,
              ]}
            >
              {t(`reservation.service.${s.key}` as any)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

const styles = StyleSheet.create({
  dateRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  dateChip: {
    width: 64,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateChipDay: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dateChipDayActive: { color: colors.black },
  dateChipNum: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 2,
  },
  dateChipNumActive: { color: colors.black },
  dateChipMonth: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontSize: 10,
  },
  dateChipMonthActive: { color: colors.black },

  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 76,
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeChipDisabled: {
    opacity: 0.35,
  },
  timeChipText: {
    ...typography.bodyBold,
    color: colors.text,
    fontSize: 14,
  },
  timeChipTextActive: { color: colors.black },
  timeChipTextDisabled: { color: colors.textDim },

  serviceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  serviceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  serviceLabel: {
    ...typography.bodyBold,
    color: colors.text,
    fontSize: 14,
  },
  serviceLabelActive: {
    color: colors.black,
  },
});

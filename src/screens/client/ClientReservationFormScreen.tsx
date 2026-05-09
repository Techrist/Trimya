import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import {
  DateSlotPicker,
  TimeSlotPicker,
  ServicePicker,
} from '@/components/SlotPickers';
import { storage } from '@/services/storage';
import { getCustomer } from '@/services/customers';
import { createReservation } from '@/services/reservations';
import { useT } from '@/i18n';
import { colors, spacing, typography, radius } from '@/theme';
import { Customer, ReservationService } from '@/types';
import { ClientTabParamList, ReservationsStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ReservationsStackParamList, 'ReservationForm'>;

export function ClientReservationFormScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [date, setDate] = useState<number>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const [time, setTime] = useState<number | null>(null);
  const [service, setService] = useState<ReservationService>('cut');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) return;
      const c = await getCustomer(id);
      setCustomer(c);
    })();
  }, []);

  const handleSubmit = async () => {
    if (!customer) return;
    if (!time) {
      Alert.alert(t('reservation.form.timeRequired'), t('reservation.form.timeRequiredHint'));
      return;
    }
    setSubmitting(true);
    try {
      await createReservation({
        customer,
        service,
        scheduledFor: time,
        note: note.trim() || undefined,
      });
      Alert.alert(
        t('reservation.form.sentTitle'),
        t('reservation.form.sentText'),
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('reservation.form.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>{t('reservation.form.date')}</Text>
        <DateSlotPicker value={date} onChange={(d) => { setDate(d); setTime(null); }} />

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>{t('reservation.form.time')}</Text>
        <TimeSlotPicker date={date} value={time} onChange={setTime} />

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>{t('reservation.form.service')}</Text>
        <ServicePicker value={service} onChange={setService} />

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
          {t('reservation.form.note')}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('reservation.form.notePlaceholder')}
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={200}
          style={styles.note}
        />

        <View style={styles.submitWrap}>
          <Button
            label={t('reservation.form.submit')}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!time}
          />
        </View>
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
    paddingBottom: spacing.xxl + spacing.xl,
  },
  submitWrap: {
    marginTop: spacing.xl,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  note: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

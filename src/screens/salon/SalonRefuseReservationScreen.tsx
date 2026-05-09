import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { getCustomer } from '@/services/customers';
import { getReservation, updateReservationStatus } from '@/services/reservations';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { Customer, Reservation } from '@/types';
import { ReservationsStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ReservationsStackParamList, 'RefuseReservation'>;
type Rt = RouteProp<ReservationsStackParamList, 'RefuseReservation'>;

export function SalonRefuseReservationScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { reservationId } = route.params;
  const { t } = useT();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await getReservation(reservationId);
      setReservation(r);
      if (r) {
        const c = await getCustomer(r.customerId);
        setCustomer(c);
      }
    })();
  }, [reservationId]);

  const handleSubmit = async () => {
    if (!reservation) return;
    setSubmitting(true);
    try {
      await updateReservationStatus({
        reservation,
        status: 'refused',
        by: 'salon',
        refusedReason: reason.trim() || undefined,
        customer,
      });
      nav.goBack();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('salon.refuse.errorRefuse'));
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
        <Text style={styles.headerTitle}>{t('salon.refuse.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>{t('salon.refuse.reason')}</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('salon.refuse.reasonPlaceholder')}
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={200}
            style={styles.input}
          />

          <View style={styles.submitWrap}>
            <Button
              label={t('salon.refuse.cta')}
              onPress={handleSubmit}
              loading={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitWrap: {
    marginTop: spacing.xl,
  },
});

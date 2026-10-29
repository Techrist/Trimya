import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Home, MapPin, MessageSquare } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DateSlotPicker, TimeSlotPicker } from '@/components/SlotPickers';
import { storage } from '@/services/storage';
import { getCustomer } from '@/services/customers';
import { getSalon } from '@/services/salons';
import { createHomeServiceRequest } from '@/services/homeServiceRequests';
import { useT } from '@/i18n';
import { humanizeError } from '@/lib/humanizeError';
import { colors, radius, spacing, typography } from '@/theme';
import { Customer, Salon } from '@/types';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientHomeRequest'>;
type Rt = RouteProp<RootStackParamList, 'ClientHomeRequest'>;

/**
 * Formulaire de création d'une demande de service à domicile.
 * Pré-rempli avec le coiffeur choisi sur l'écran précédent.
 */
export function ClientHomeRequestScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { barberId, barberName } = route.params;
  const { t } = useT();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [addressNotes, setAddressNotes] = useState('');
  const [message, setMessage] = useState('');
  // Créneau souhaité : date (00:00) et slot (full timestamp choisi)
  const [dateMs, setDateMs] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const [slotTs, setSlotTs] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await storage.getCustomerId();
      if (!id) return;
      const c = await getCustomer(id);
      setCustomer(c);
      if (c?.salonId) {
        const s = await getSalon(c.salonId);
        setSalon(s);
      }
    })();
  }, []);

  // Quand le client change de jour, on reset le slot pour ne pas garder un
  // timestamp pointant sur l'ancien jour.
  const handleDateChange = (ts: number) => {
    setDateMs(ts);
    setSlotTs(null);
  };

  const requestedFor = slotTs ?? 0;

  const handleSubmit = async () => {
    if (!customer) {
      Alert.alert(t('common.error'), t('client.homeRequest.noCustomer'));
      return;
    }
    if (address.trim().length < 5) {
      Alert.alert(t('common.error'), t('client.homeRequest.addressTooShort'));
      return;
    }
    if (!slotTs || requestedFor < Date.now()) {
      Alert.alert(t('common.error'), t('client.homeRequest.dateInPast'));
      return;
    }

    setSubmitting(true);
    try {
      await createHomeServiceRequest({
        customer,
        barberId,
        barberName,
        address: address.trim(),
        city: city.trim() || undefined,
        addressNotes: addressNotes.trim() || undefined,
        requestedFor,
        message: message.trim() || undefined,
        salon,
      });
      Alert.alert(
        t('client.homeRequest.successTitle'),
        t('client.homeRequest.successText', { name: barberName }),
        [{ text: 'OK', onPress: () => nav.pop(2) }],
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), humanizeError(e, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('client.homeRequest.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Récapitulatif coiffeur */}
        <Card style={styles.recapCard}>
          <Home color={colors.primary} size={20} strokeWidth={2.2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.recapLabel}>{t('client.homeRequest.barberLabel')}</Text>
            <Text style={styles.recapValue}>{barberName}</Text>
          </View>
        </Card>

        {/* Adresse */}
        <Text style={styles.sectionLabel}>
          {t('client.homeRequest.addressSection')}
        </Text>
        <View style={styles.fieldRow}>
          <MapPin color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.homeRequest.fieldAddress')}</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder={t('client.homeRequest.addressPlaceholder')}
              placeholderTextColor={colors.textDim}
              style={styles.input}
              maxLength={200}
            />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={{ width: 18 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.homeRequest.fieldCity')}</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder={t('client.homeRequest.cityPlaceholder')}
              placeholderTextColor={colors.textDim}
              style={styles.input}
              maxLength={80}
              autoCapitalize="words"
            />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={{ width: 18 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{t('client.homeRequest.fieldNotes')}</Text>
            <TextInput
              value={addressNotes}
              onChangeText={setAddressNotes}
              placeholder={t('client.homeRequest.notesPlaceholder')}
              placeholderTextColor={colors.textDim}
              style={[styles.input, styles.multiline]}
              maxLength={200}
              multiline
            />
          </View>
        </View>

        {/* Créneau */}
        <Text style={styles.sectionLabel}>
          {t('client.homeRequest.slotSection')}
        </Text>
        <DateSlotPicker value={dateMs} onChange={handleDateChange} daysAhead={14} />
        <TimeSlotPicker date={dateMs} value={slotTs} onChange={setSlotTs} />

        {/* Message */}
        <Text style={styles.sectionLabel}>
          {t('client.homeRequest.messageSection')}
        </Text>
        <View style={styles.fieldRow}>
          <MessageSquare color={colors.textMuted} size={18} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={t('client.homeRequest.messagePlaceholder')}
              placeholderTextColor={colors.textDim}
              style={[styles.input, styles.multiline]}
              maxLength={280}
              multiline
            />
          </View>
        </View>

        <View style={styles.submitWrap}>
          <Button
            label={t('client.homeRequest.submitCta')}
            onPress={handleSubmit}
            loading={submitting}
            disabled={address.trim().length < 5}
          />
        </View>

        <Text style={styles.legalHint}>
          {t('client.homeRequest.legalHint')}
        </Text>
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
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  recapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  recapLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  recapValue: {
    ...typography.h3,
    color: colors.text,
    marginTop: 2,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  submitWrap: {
    marginTop: spacing.xl,
  },
  legalHint: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
});

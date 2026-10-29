import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Phone } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { sendOtpForPhoneChange } from '@/services/auth';
import { useT } from '@/i18n';
import { humanizeError } from '@/lib/humanizeError';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientChangePhone'>;

/**
 * Étape 1 du changement de numéro : le client saisit son nouveau numéro,
 * on lui envoie un SMS OTP. Étape 2 dans ClientChangePhoneVerifyScreen.
 *
 * Note : le client reste authentifié pendant tout le flow. À la fin, son
 * UID Firebase ne change PAS — seul le champ `phoneNumber` est re-link
 * via `updatePhoneNumber`. L'historique de coupes, l'abonnement, les
 * notifications push : tout reste lié au même compte.
 */
export function ClientChangePhoneScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const cleaned = phone.replace(/\s+/g, '');
    if (!/^\+?\d{8,15}$/.test(cleaned)) {
      Alert.alert(
        t('client.changePhone.invalidTitle'),
        t('client.changePhone.invalidHint'),
      );
      return;
    }
    const e164 = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    setLoading(true);
    try {
      await sendOtpForPhoneChange(e164);
      nav.navigate('ClientChangePhoneVerify', { phone: e164 });
    } catch (e: any) {
      Alert.alert(t('common.error'), humanizeError(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <Pressable
        onPress={() => nav.goBack()}
        hitSlop={12}
        style={styles.backBtn}
      >
        <ChevronLeft color={colors.textMuted} size={22} strokeWidth={2.2} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Phone color={colors.primary} size={32} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>{t('client.changePhone.title')}</Text>
        <Text style={styles.subtitle}>{t('client.changePhone.subtitle')}</Text>
      </View>

      <TextField
        label={t('client.changePhone.newPhoneLabel')}
        placeholder={t('client.changePhone.newPhonePlaceholder')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      <Button
        label={t('client.changePhone.sendOtp')}
        onPress={handleSend}
        loading={loading}
        disabled={phone.replace(/\s+/g, '').length < 8}
      />

      <Text style={styles.legal}>{t('client.changePhone.legalHint')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.textMuted,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  legal: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { confirmPhoneChange } from '@/services/auth';
import { setCustomerPhone } from '@/services/customers';
import { useT } from '@/i18n';
import { humanizeError } from '@/lib/humanizeError';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<
  RootStackParamList,
  'ClientChangePhoneVerify'
>;
type Rt = RouteProp<RootStackParamList, 'ClientChangePhoneVerify'>;

/**
 * Étape 2 du changement de numéro : le client saisit le code OTP reçu sur
 * son nouveau numéro. On confirme côté Firebase Auth (updatePhoneNumber)
 * puis on aligne le doc Firestore customers/{uid}.
 *
 * Si succès : retour au profil avec succès. Si échec : message d'erreur.
 */
export function ClientChangePhoneVerifyScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { phone } = route.params;
  const { t } = useT();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length < 6) {
      Alert.alert(
        t('client.changePhone.codeTooShort'),
        t('client.changePhone.codeTooShortHint'),
      );
      return;
    }
    setLoading(true);
    try {
      const uid = await confirmPhoneChange(code, phone);
      // Aligne le doc Firestore — le uid est inchangé, on met juste à
      // jour le champ phone.
      await setCustomerPhone(uid, phone);
      Alert.alert(
        t('client.changePhone.successTitle'),
        t('client.changePhone.successText', { phone }),
        [{ text: 'OK', onPress: () => nav.pop(2) }], // retour profil
      );
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
          <ShieldCheck color={colors.primary} size={32} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>
          {t('client.changePhone.verifyTitle')}
        </Text>
        <Text style={styles.subtitle}>
          {t('client.changePhone.verifySubtitle', { phone })}
        </Text>
      </View>

      <TextField
        label={t('client.changePhone.codeLabel')}
        placeholder="123456"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
      />

      <Button
        label={t('client.changePhone.verifyCta')}
        onPress={handleVerify}
        loading={loading}
        disabled={code.length < 6}
      />
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
});

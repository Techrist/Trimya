import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { LegalLinks } from '@/components/LegalLinks';
import { useScreenCapturePrevention } from '@/hooks/useScreenCapturePrevention';
import { requestOtp, otpErrorMessage } from '@/services/otpAuth';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EmailSignup'>;

/**
 * Écran de saisie d'email pour l'app Client.
 *
 * Remplace l'ancien `PhoneSignupScreen` : plus de SMS (bloqués au Cameroun
 * par MTN), plus de reCAPTCHA (bloqué par les trackers protections type
 * Firefox). À la place, un email simple → un magic link → session Firebase
 * classique.
 *
 * L'utilisateur reçoit le lien dans sa boîte, clique dessus, et retombe sur
 * la PWA déjà connecté. On passe l'étape de saisie de code OTP entièrement.
 */
export function EmailSignupScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  useScreenCapturePrevention();

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert(t('auth.email.invalid'), t('auth.email.invalidHint'));
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp(trimmed, 'client');
      if (!result.ok) {
        Alert.alert(
          t('common.error'),
          otpErrorMessage(result.error ?? 'internal_error', t),
        );
        return;
      }
      nav.navigate('OtpCodeVerify', { email: trimmed });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <Logo size={72} />
        <Text style={styles.title}>{t('auth.email.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.email.subtitle')}</Text>
      </View>

      <TextField
        label={t('auth.email.label')}
        placeholder={t('auth.email.placeholder')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <Button label={t('auth.email.send')} onPress={handleSend} loading={loading} />

      <LegalLinks variant="inline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
});

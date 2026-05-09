import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { sendOtp } from '@/services/auth';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PhoneSignup'>;

export function PhoneSignupScreen() {
  const nav = useNavigation<Nav>();
  const { clearMode } = useApp();
  const { t } = useT();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const cleaned = phone.replace(/\s+/g, '');
    if (!/^\+?\d{8,15}$/.test(cleaned)) {
      Alert.alert(t('auth.phone.invalid'), t('auth.phone.invalidHint'));
      return;
    }
    const e164 = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    setLoading(true);
    try {
      await sendOtp(e164);
      nav.navigate('OtpVerify', { phone: e164 });
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('auth.phone.errorSend'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <Logo size={56} />
        <Text style={styles.title}>{t('auth.phone.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.phone.subtitle')}</Text>
      </View>

      <TextField
        label={t('auth.phone.label')}
        placeholder={t('auth.phone.placeholder')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      <Button label={t('auth.phone.send')} onPress={handleSend} loading={loading} />

      <Button
        label={t('auth.phone.notClient')}
        onPress={async () => {
          await clearMode();
          nav.reset({ index: 0, routes: [{ name: 'RoleSelection' }] });
        }}
        variant="ghost"
      />

      <Text style={styles.legal}>{t('auth.phone.legal')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  legal: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { verifyOtp } from '@/services/auth';
import { findCustomerByPhone } from '@/services/customers';
import { storage } from '@/services/storage';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OtpVerify'>;
type Rt = RouteProp<RootStackParamList, 'OtpVerify'>;

const DEFAULT_SALON_ID = process.env.EXPO_PUBLIC_DEFAULT_SALON_ID || 'default-salon';

export function OtpVerifyScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { phone } = route.params;
  const { t } = useT();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length < 4) {
      Alert.alert(t('auth.otp.tooShort'), t('auth.otp.tooShortHint'));
      return;
    }
    setLoading(true);
    try {
      const user = await verifyOtp(code);
      const existing = await findCustomerByPhone(phone, DEFAULT_SALON_ID);
      if (existing) {
        await storage.setCustomerId(existing.id);
        nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
      } else {
        await storage.setCustomerId(user.uid);
        nav.replace('ClientName');
      }
    } catch (e: any) {
      Alert.alert(t('auth.otp.invalid'), e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.otp.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.otp.subtitle', { phone })}</Text>
      </View>

      <TextField
        label={t('auth.otp.label')}
        placeholder={t('auth.otp.placeholder')}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />

      <Button label={t('auth.otp.verify')} onPress={handleVerify} loading={loading} />
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
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  phone: {
    color: colors.text,
    fontWeight: '600',
  },
});

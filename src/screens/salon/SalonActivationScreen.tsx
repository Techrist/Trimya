import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { activateSalonByCode, registerSalonKioskUid } from '@/services/salons';
import { signInAsSalonKiosk, currentUser } from '@/services/auth';
import { registerSalonKioskPushToken } from '@/services/push';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SalonActivation'>;

export function SalonActivationScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { setSalonId, clearMode } = useApp();

  const handleActivate = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      Alert.alert(t('salon.activation.codeTooShort'), t('salon.activation.codeTooShortHint'));
      return;
    }
    setLoading(true);
    try {
      const user = await signInAsSalonKiosk();
      const salon = await activateSalonByCode(trimmed);
      // Link this device's auth UID to the salon so server-side rules can
      // verify "is this writer actually a kiosk of this salon?".
      await registerSalonKioskUid(salon.id, user.uid);
      await setSalonId(salon.id);
      registerSalonKioskPushToken(salon.id);
      nav.reset({ index: 0, routes: [{ name: 'SalonTabs' }] });
    } catch (e: any) {
      Alert.alert(t('salon.activation.failed'), e.message || t('salon.activation.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <Logo size={56} />
        <Text style={styles.title}>{t('salon.activation.title')}</Text>
        <Text style={styles.subtitle}>{t('salon.activation.subtitle')}</Text>
      </View>

      <TextField
        label={t('salon.activation.codeLabel')}
        placeholder={t('salon.activation.codePlaceholder')}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <Button label={t('salon.activation.activate')} onPress={handleActivate} loading={loading} />

      <Button
        label={t('salon.activation.notSalon')}
        onPress={async () => {
          await clearMode();
          nav.reset({ index: 0, routes: [{ name: 'RoleSelection' }] });
        }}
        variant="ghost"
      />
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
});

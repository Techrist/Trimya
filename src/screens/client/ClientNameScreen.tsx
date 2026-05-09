import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { createCustomer } from '@/services/customers';
import { currentUser } from '@/services/auth';
import { storage } from '@/services/storage';
import { ensureNotificationPermission } from '@/services/notifications';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientName'>;

const DEFAULT_SALON_ID = process.env.EXPO_PUBLIC_DEFAULT_SALON_ID || 'default-salon';

export function ClientNameScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert(t('auth.name.tooShort'), t('auth.name.tooShortHint'));
      return;
    }
    setLoading(true);
    try {
      const user = currentUser();
      if (!user) throw new Error('Session expirée.');
      await createCustomer({
        id: user.uid,
        phone: user.phoneNumber || '',
        name: trimmed,
        salonId: DEFAULT_SALON_ID,
      });
      await storage.setCustomerId(user.uid);
      await ensureNotificationPermission();
      nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('auth.name.errorCreate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.name.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.name.subtitle')}</Text>
      </View>

      <TextField
        label={t('auth.name.label')}
        placeholder={t('auth.name.placeholder')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
      />

      <Button label={t('common.continue')} onPress={handleContinue} loading={loading} />
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
});

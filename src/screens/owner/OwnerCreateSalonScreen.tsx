import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { accountErrorText, isStrongPassword } from '@/lib/accountErrors';
import { createOwnerSalon } from '@/services/ownerSalons';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { OwnerSalonsStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerSalonsStackParamList, 'OwnerCreateSalon'>;

/**
 * Le propriétaire crée un salon de sa chaîne ET ses identifiants de
 * connexion (email + mot de passe). Il les communique ensuite au salon.
 */
export function OwnerCreateSalonScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const errText = (e: unknown): string => {
    const code = e instanceof Error ? e.message : '';
    const key = `owner.createSalon.error.${code}`;
    const msg = t(key as never);
    return msg === key ? accountErrorText(e, t) : msg;
  };

  const submit = async () => {
    setError(null);
    if (!isStrongPassword(password)) return setError(t('account.error.weak_password'));
    setLoading(true);
    try {
      await createOwnerSalon({ name, city, phone, email, password });
      setDone(true);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  };

  const valid =
    name.trim().length >= 2 &&
    city.trim().length >= 2 &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    password.length >= 8;

  return (
    <Screen padded keyboardAvoiding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('owner.createSalon.title')}</Text>

        {done ? (
          <>
            <Text style={styles.success}>{t('owner.createSalon.success')}</Text>
            <Button label={t('owner.createSalon.back')} onPress={() => nav.goBack()} />
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>{t('owner.createSalon.subtitle')}</Text>
            <TextField
              label={t('owner.createSalon.name')}
              value={name}
              onChangeText={setName}
              maxLength={80}
            />
            <TextField
              label={t('owner.createSalon.city')}
              value={city}
              onChangeText={setCity}
              maxLength={80}
            />
            <TextField
              label={t('owner.createSalon.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={25}
            />
            <TextField
              label={t('owner.createSalon.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              maxLength={254}
            />
            <TextField
              label={t('owner.createSalon.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              maxLength={128}
            />
            <Text style={styles.hint}>{t('account.password.hint')}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={{ height: spacing.sm }} />
            <Button
              label={t('owner.createSalon.submit')}
              onPress={submit}
              loading={loading}
              disabled={!valid}
            />
            <Button label={t('owner.createSalon.back')} onPress={() => nav.goBack()} variant="ghost" />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  title: { ...typography.h1, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  hint: { ...typography.caption, color: colors.textDim, marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.sm },
  success: { ...typography.body, color: colors.success, marginVertical: spacing.lg },
});

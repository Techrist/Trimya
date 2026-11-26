import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { LegalLinks } from '@/components/LegalLinks';
import {
  createSalonAccount,
  requestSalonSignupCode,
} from '@/services/salons';
import { signInAsSalonKiosk } from '@/services/auth';
import { registerSalonKioskPushToken } from '@/services/push';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SalonSignup'>;
type Step = 'email' | 'details' | 'success';

/**
 * Inscription libre d'un salon : email vérifié par code → infos du salon →
 * salon créé, appareil appairé, essai Pro de 14 jours. Aucun code
 * d'activation à saisir ; un code de secours est affiché à la fin.
 *
 * Les protections anti-abus (limites, doublons, emails jetables) sont
 * toutes côté serveur (/api/salon-signup/*).
 */
export function SalonSignupScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const { setSalonId } = useApp();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [backupCode, setBackupCode] = useState('');

  const errText = (e: unknown): string => {
    const c = e instanceof Error ? e.message : '';
    const key = `salon.signup.error.${c}`;
    const msg = t(key as never);
    return msg === key ? t('salon.signup.error.generic') : msg;
  };

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await requestSalonSignupCode(email);
      setStep('details');
      setInfo(t('salon.signup.codeSent'));
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      // Session anonyme du kiosque : c'est elle qui sera appairée au salon.
      await signInAsSalonKiosk();
      const r = await createSalonAccount({
        email,
        code: code.trim(),
        name,
        city,
        ownerName,
        phone,
      });
      await setSalonId(r.salon.id);
      registerSalonKioskPushToken(r.salon.id, { askPermission: true });
      setBackupCode(r.activationCode);
      setStep('success');
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  };

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const detailsValid =
    code.trim().length === 6 &&
    name.trim().length >= 2 &&
    city.trim().length >= 2 &&
    ownerName.trim().length >= 2 &&
    phone.replace(/\D/g, '').length >= 8 &&
    accepted;

  if (step === 'success') {
    return (
      <Screen padded>
        <View style={styles.header}>
          <Logo size={72} />
          <Text style={styles.title}>{t('salon.signup.successTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('salon.signup.successText', { code: backupCode })}
          </Text>
        </View>
        <Button
          label={t('salon.signup.successCta')}
          onPress={() => nav.reset({ index: 0, routes: [{ name: 'SalonTabs' }] })}
        />
      </Screen>
    );
  }

  return (
    <Screen padded keyboardAvoiding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Logo size={72} />
          <Text style={styles.title}>{t('salon.signup.title')}</Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? t('salon.signup.emailSubtitle')
              : t('salon.signup.detailsSubtitle', { email: email.trim() })}
          </Text>
        </View>

        {step === 'email' ? (
          <>
            <TextField
              label={t('salon.signup.emailLabel')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              maxLength={254}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={t('salon.signup.sendCode')}
              onPress={sendCode}
              loading={loading}
              disabled={!emailValid}
            />
          </>
        ) : (
          <>
            <TextField
              label={t('salon.signup.codeLabel')}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
            />
            <TextField
              label={t('salon.signup.nameLabel')}
              value={name}
              onChangeText={setName}
              maxLength={80}
            />
            <TextField
              label={t('salon.signup.cityLabel')}
              value={city}
              onChangeText={setCity}
              maxLength={80}
            />
            <TextField
              label={t('salon.signup.ownerLabel')}
              value={ownerName}
              onChangeText={setOwnerName}
              maxLength={80}
            />
            <TextField
              label={t('salon.signup.phoneLabel')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={25}
            />

            <ConsentCheckbox checked={accepted} onChange={setAccepted} />

            {info ? <Text style={styles.info}>{info}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={{ height: spacing.md }} />
            <Button
              label={t('salon.signup.create')}
              onPress={create}
              loading={loading}
              disabled={!detailsValid}
            />
            <Button
              label={t('salon.signup.resend')}
              onPress={sendCode}
              variant="ghost"
              disabled={loading}
            />
            <Button
              label={t('salon.signup.changeEmail')}
              onPress={() => {
                setStep('email');
                setCode('');
                setError(null);
                setInfo(null);
              }}
              variant="ghost"
              disabled={loading}
            />
          </>
        )}

        <Button
          label={t('salon.signup.orHaveCode')}
          onPress={() => nav.replace('SalonActivation')}
          variant="ghost"
        />
        <LegalLinks variant="inline" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
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
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  info: {
    ...typography.caption,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});

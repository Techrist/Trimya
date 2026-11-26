import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { LegalLinks } from '@/components/LegalLinks';
import { AuthFooterLink } from '@/components/AuthFooterLink';
import { accountErrorText, isStrongPassword } from '@/lib/accountErrors';
import {
  requestSignupCode,
  resolveClientDestination,
  signInWithPassword,
  submitClientSignup,
  verifySignupCode,
} from '@/services/account';
import { storage } from '@/services/storage';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientSignUp'>;
type Step = 'creds' | 'code';

/**
 * Création de compte client : email + mot de passe → code reçu par email →
 * compte créé et connecté. Le prénom / nom / consentement sont saisis juste
 * après (écran ClientName), comme avant.
 */
export function ClientSignUpScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();

  const [step, setStep] = useState<Step>('creds');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    if (!isStrongPassword(password)) return setError(t('account.error.weak_password'));
    if (password !== confirm) return setError(t('account.error.password_mismatch'));
    setLoading(true);
    try {
      await requestSignupCode(email, 'client');
      setStep('code');
      setInfo(t('account.signUp.codeSent'));
    } catch (e) {
      setError(accountErrorText(e, t));
    } finally {
      setLoading(false);
    }
  };

  const verifyAndCreate = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const proof = await verifySignupCode(email, code);
      await submitClientSignup({ email, proof, password });
      const user = await signInWithPassword(email, password);
      const dest = await resolveClientDestination(user);
      await storage.setCustomerId(user.uid);
      nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: dest }] }));
    } catch (e) {
      setError(accountErrorText(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Logo size={72} />
          <Text style={styles.title}>{t('client.signUp.title')}</Text>
          <Text style={styles.subtitle}>
            {step === 'creds'
              ? t('account.signUp.credsSubtitle')
              : t('account.signUp.codeSubtitle', { email: email.trim() })}
          </Text>
        </View>

        {step === 'creds' ? (
          <>
            <TextField
              label={t('account.field.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              maxLength={254}
            />
            <TextField
              label={t('account.field.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              maxLength={128}
            />
            <Text style={styles.hint}>{t('account.password.hint')}</Text>
            <TextField
              label={t('account.field.confirmPassword')}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              maxLength={128}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={t('account.signUp.sendCode')}
              onPress={sendCode}
              loading={loading}
              disabled={!emailValid || !password || !confirm}
            />
          </>
        ) : (
          <>
            <TextField
              label={t('account.field.code')}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
            {info ? <Text style={styles.info}>{info}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={t('client.signUp.createCta')}
              onPress={verifyAndCreate}
              loading={loading}
              disabled={code.length !== 6}
            />
            <Button
              label={t('account.signUp.resend')}
              onPress={sendCode}
              variant="ghost"
              disabled={loading}
            />
            <Button
              label={t('account.signUp.changeEmail')}
              onPress={() => {
                setStep('creds');
                setCode('');
                setError(null);
                setInfo(null);
              }}
              variant="ghost"
              disabled={loading}
            />
          </>
        )}

        <AuthFooterLink
          text={t('account.signUp.alreadyHave')}
          linkText={t('account.signUp.signInLink')}
          onPress={() => nav.replace('ClientSignIn')}
        />
        <LegalLinks variant="inline" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.text, textAlign: 'center', marginTop: spacing.md },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  hint: { ...typography.caption, color: colors.textDim, marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.sm },
  info: { ...typography.caption, color: colors.success, textAlign: 'center', marginBottom: spacing.sm },
});

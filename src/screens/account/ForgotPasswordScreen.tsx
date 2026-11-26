import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { accountErrorText, isStrongPassword } from '@/lib/accountErrors';
import { confirmPasswordReset, requestPasswordReset } from '@/services/account';
import { isProApp } from '@/lib/appTarget';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
type Step = 'email' | 'reset' | 'done';

/**
 * Mot de passe oublié : email → code reçu par email → nouveau mot de passe.
 * Le serveur répond toujours « ok » à la première étape (anti-énumération).
 */
export function ForgotPasswordScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  // Retour vers la connexion de l'app courante (Pro ou Client).
  const signInRoute = isProApp() ? 'AccountSignIn' : 'ClientSignIn';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setStep('reset');
    } catch (e) {
      setError(accountErrorText(e, t));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!isStrongPassword(password)) return setError(t('account.error.weak_password'));
    if (password !== confirm) return setError(t('account.error.password_mismatch'));
    setLoading(true);
    try {
      await confirmPasswordReset({ email, code, password });
      setStep('done');
    } catch (e) {
      setError(accountErrorText(e, t));
    } finally {
      setLoading(false);
    }
  };

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <Screen padded keyboardAvoiding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Logo size={72} />
          <Text style={styles.title}>{t('account.forgot.title')}</Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? t('account.forgot.emailSubtitle')
              : step === 'reset'
                ? t('account.forgot.codeSubtitle', { email: email.trim() })
                : t('account.forgot.done')}
          </Text>
        </View>

        {step === 'email' ? (
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
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={t('account.forgot.send')}
              onPress={sendCode}
              loading={loading}
              disabled={!emailValid}
            />
          </>
        ) : null}

        {step === 'reset' ? (
          <>
            <TextField
              label={t('account.field.code')}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
            />
            <TextField
              label={t('account.field.newPassword')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Text style={styles.hint}>{t('account.password.hint')}</Text>
            <TextField
              label={t('account.field.confirmPassword')}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={t('account.forgot.submit')}
              onPress={submit}
              loading={loading}
              disabled={code.length !== 6 || !password || !confirm}
            />
            <Button
              label={t('account.signUp.resend')}
              onPress={sendCode}
              variant="ghost"
              disabled={loading}
            />
          </>
        ) : null}

        {step === 'done' ? (
          <Button
            label={t('account.forgot.backToSignIn')}
            onPress={() => nav.replace(signInRoute)}
          />
        ) : (
          <Button
            label={t('account.forgot.backToSignIn')}
            onPress={() => nav.replace(signInRoute)}
            variant="ghost"
          />
        )}
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
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});

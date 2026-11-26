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
import { accountErrorText } from '@/lib/accountErrors';
import { resolveClientDestination, signInWithPassword } from '@/services/account';
import { signOut } from '@/services/auth';
import { storage } from '@/services/storage';
import { useScreenCapturePrevention } from '@/hooks/useScreenCapturePrevention';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientSignIn'>;

/**
 * Premier écran de l'app Client : connexion par email + mot de passe.
 * En bas : « Pas encore de compte ? S'inscrire ».
 */
export function ClientSignInScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  useScreenCapturePrevention();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithPassword(email, password);
      try {
        const dest = await resolveClientDestination(user);
        await storage.setCustomerId(user.uid);
        nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: dest }] }));
      } catch (e) {
        // Compte Pro dans l'app client : on referme la session.
        await signOut().catch(() => undefined);
        throw e;
      }
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
          <Text style={styles.title}>{t('client.signIn.title')}</Text>
          <Text style={styles.subtitle}>{t('client.signIn.subtitle')}</Text>
        </View>

        <TextField
          label={t('account.field.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
        <TextField
          label={t('account.field.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={t('account.signIn.submit')}
          onPress={submit}
          loading={loading}
          disabled={!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 1}
        />
        <Button
          label={t('account.signIn.forgot')}
          onPress={() => nav.navigate('ForgotPassword')}
          variant="ghost"
        />

        <AuthFooterLink
          text={t('account.signIn.noAccount')}
          linkText={t('account.signIn.signUp')}
          onPress={() => nav.navigate('ClientSignUp')}
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
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});

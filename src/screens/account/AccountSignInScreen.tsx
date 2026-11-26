import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { LegalLinks } from '@/components/LegalLinks';
import { AuthFooterLink } from '@/components/AuthFooterLink';
import { accountErrorText } from '@/lib/accountErrors';
import { navigateToRoot } from '@/navigation/navigateToRoot';
import { resolveDestination, signInWithPassword } from '@/services/account';
import { signOut } from '@/services/auth';
import { useAccountNavigation } from '@/hooks/useAccountNavigation';
import { useScreenCapturePrevention } from '@/hooks/useScreenCapturePrevention';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AccountSignIn'>;

/**
 * Connexion par email + mot de passe, pour les salons ET les propriétaires.
 * Le rôle est déduit du compte (pas besoin de le choisir avant).
 */
export function AccountSignInScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const { clearMode } = useApp();
  const goTo = useAccountNavigation();
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
        await goTo(await resolveDestination(user));
      } catch (e) {
        // Connecté à Firebase mais sans compte Pro exploitable : on referme la session.
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
          <Text style={styles.title}>{t('account.signIn.title')}</Text>
          <Text style={styles.subtitle}>{t('account.signIn.subtitle')}</Text>
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
        <Button
          label={t('common.back')}
          onPress={async () => {
            await clearMode();
            navigateToRoot(nav);
          }}
          variant="ghost"
        />
        <AuthFooterLink
          text={t('account.signIn.noAccount')}
          linkText={t('account.signIn.signUp')}
          onPress={() => nav.navigate('AccountSignUp')}
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

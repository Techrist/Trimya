import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Mail } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { humanizeError } from '@/lib/humanizeError';
import { colors, spacing, typography } from '@/theme';

/**
 * Affiché quand l'utilisateur ouvre un magic link depuis un autre device que
 * celui où il a demandé le lien. Firebase a besoin de re-confirmer l'email,
 * en défense anti-interception (sans ça, n'importe quel attaquant qui
 * intercepte le lien dans les logs d'un routeur pourrait se connecter).
 *
 * Note : si l'utilisateur tape un email différent de celui du lien, Firebase
 * remonte auth/invalid-email ou auth/invalid-action-code — on expose un
 * message clair via humanizeError.
 */
export function MagicLinkNeedEmailScreen() {
  const { completeMagicLinkWithEmail, magicLinkError } = useApp();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConfirm = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setLocalError(t('auth.email.invalidHint'));
      return;
    }
    setLocalError(null);
    setLoading(true);
    try {
      await completeMagicLinkWithEmail(trimmed);
    } catch (e: any) {
      setLocalError(humanizeError(e, t));
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || magicLinkError;

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Mail color={colors.primary} size={40} strokeWidth={2} />
        </View>
        <Text style={styles.title}>{t('auth.email.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.emailSent.needEmail')}</Text>
      </View>

      <TextField
        label={t('auth.email.label')}
        placeholder={t('auth.email.placeholder')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoFocus
      />

      {displayError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{displayError}</Text>
        </View>
      ) : null}

      <Button
        label={t('owner.signin.cta')}
        onPress={handleConfirm}
        loading={loading}
        disabled={!email}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, Pressable } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { navigateToRoot } from '@/navigation/navigateToRoot';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mail, Lock, Building2, Wand2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LegalLinks } from '@/components/LegalLinks';
import { humanizeError } from '@/lib/humanizeError';
import { useScreenCapturePrevention } from '@/hooks/useScreenCapturePrevention';
import { signInAsOwner } from '@/services/owners';
import { sendMagicLink } from '@/services/emailAuth';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OwnerSignIn'>;

type Method = 'password' | 'magicLink';

/**
 * Écran de connexion propriétaire — propose deux méthodes :
 *
 *  1. Mot de passe (historique) — email + password, flux signInAsOwner existant
 *  2. Magic link (nouveau) — email uniquement, Firebase envoie un lien par
 *     email, l'owner clique dessus pour se connecter en un clic
 *
 * Magic link est préféré pour les comptes qui n'ont jamais mis de mot de passe
 * (comptes créés via admin). Mot de passe reste disponible comme fallback.
 */
export function OwnerSignInScreen() {
  const nav = useNavigation<Nav>();
  const { setOwnerId, clearMode } = useApp();
  const { t } = useT();

  const [method, setMethod] = useState<Method>('magicLink');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  useScreenCapturePrevention();

  const handlePasswordSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const { owner } = await signInAsOwner(email.trim(), password);
      await setOwnerId(owner.id);
      nav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'OwnerTabs' }],
        }),
      );
    } catch (e: any) {
      setError(humanizeError(e, t));
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSend = async () => {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t('auth.email.invalidHint'));
      return;
    }
    setLoading(true);
    try {
      // On passe 'owner' comme cible : le callback au boot saura router vers
      // OwnerTabs au lieu de ClientTabs.
      await sendMagicLink(trimmed, 'owner');
      setLinkSent(true);
    } catch (e: any) {
      setError(humanizeError(e, t));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    await clearMode();
    navigateToRoot(nav);
  };

  // ─── UI post-envoi magic link ─────────────────────────────
  if (linkSent) {
    return (
      <Screen padded>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Mail color={colors.primary} size={40} strokeWidth={2} />
          </View>
          <Text style={styles.title}>{t('auth.emailSent.title')}</Text>
          <Text style={styles.subtitle}>
            {t('auth.emailSent.subtitle', { email })}
          </Text>
        </View>
        <Card style={styles.form}>
          <Text style={styles.hintText}>{t('auth.emailSent.hint1')}</Text>
          <Text style={styles.hintText}>{t('auth.emailSent.hint2')}</Text>
          <Text style={styles.hintText}>{t('auth.emailSent.hint3')}</Text>
        </Card>
        <Button
          label={t('auth.emailSent.resend')}
          onPress={handleMagicLinkSend}
          loading={loading}
          variant="secondary"
        />
        <View style={{ height: spacing.sm }} />
        <Button
          label={t('auth.emailSent.changeEmail')}
          onPress={() => setLinkSent(false)}
          variant="ghost"
        />
      </Screen>
    );
  }

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Building2 color={colors.primary} size={32} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>{t('owner.signin.title')}</Text>
        <Text style={styles.subtitle}>{t('owner.signin.subtitle')}</Text>
      </View>

      {/* ─── Sélecteur de méthode ─────────────────────── */}
      <View style={styles.methodRow}>
        <Pressable
          style={[
            styles.methodBtn,
            method === 'magicLink' && styles.methodBtnActive,
          ]}
          onPress={() => {
            setMethod('magicLink');
            setError(null);
          }}
        >
          <Wand2
            color={method === 'magicLink' ? colors.primary : colors.textMuted}
            size={16}
          />
          <Text
            style={[
              styles.methodLabel,
              method === 'magicLink' && styles.methodLabelActive,
            ]}
          >
            {t('owner.signin.methodMagicLink')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.methodBtn,
            method === 'password' && styles.methodBtnActive,
          ]}
          onPress={() => {
            setMethod('password');
            setError(null);
          }}
        >
          <Lock
            color={method === 'password' ? colors.primary : colors.textMuted}
            size={16}
          />
          <Text
            style={[
              styles.methodLabel,
              method === 'password' && styles.methodLabelActive,
            ]}
          >
            {t('owner.signin.methodPassword')}
          </Text>
        </Pressable>
      </View>

      <Card style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>{t('owner.signin.email')}</Text>
          <View style={styles.inputWrap}>
            <Mail color={colors.textMuted} size={18} strokeWidth={2} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@exemple.com"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              autoFocus
            />
          </View>
        </View>

        {method === 'password' && (
          <View style={styles.field}>
            <Text style={styles.label}>{t('owner.signin.password')}</Text>
            <View style={styles.inputWrap}>
              <Lock color={colors.textMuted} size={18} strokeWidth={2} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textDim}
                secureTextEntry
                style={styles.input}
              />
            </View>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {method === 'magicLink' ? (
          <Button
            label={t('auth.email.send')}
            onPress={handleMagicLinkSend}
            loading={loading}
            disabled={!email}
          />
        ) : (
          <Button
            label={t('owner.signin.cta')}
            onPress={handlePasswordSignIn}
            loading={loading}
            disabled={!email || !password}
          />
        )}
        <View style={{ height: spacing.sm }} />
        <Button
          label={t('common.back')}
          onPress={handleBack}
          variant="ghost"
        />
      </Card>

      <Text style={styles.legal}>{t('owner.signin.legal')}</Text>

      <LegalLinks variant="inline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  methodLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  methodLabelActive: {
    color: colors.primary,
  },
  form: {
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
  },
  hintText: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  legal: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});

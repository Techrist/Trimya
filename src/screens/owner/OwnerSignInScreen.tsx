import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mail, Lock, Building2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { signInAsOwner } from '@/services/owners';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OwnerSignIn'>;

export function OwnerSignInScreen() {
  const nav = useNavigation<Nav>();
  const { setOwnerId, clearMode } = useApp();
  const { t } = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
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
      const msg = e?.message ?? '';
      if (msg.includes('auth/invalid-credential')) {
        setError(t('owner.signin.invalidCredentials'));
      } else if (msg.includes('auth/too-many-requests')) {
        setError(t('owner.signin.tooManyAttempts'));
      } else {
        setError(msg || t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    await clearMode();
    nav.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'RoleSelection' }],
      }),
    );
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Building2 color={colors.primary} size={32} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>{t('owner.signin.title')}</Text>
        <Text style={styles.subtitle}>{t('owner.signin.subtitle')}</Text>
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

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={t('owner.signin.cta')}
          onPress={handleSignIn}
          loading={loading}
          disabled={!email || !password}
        />
        <View style={{ height: spacing.sm }} />
        <Button
          label={t('common.back')}
          onPress={handleBack}
          variant="ghost"
        />
      </Card>

      <Text style={styles.legal}>{t('owner.signin.legal')}</Text>
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
  legal: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});

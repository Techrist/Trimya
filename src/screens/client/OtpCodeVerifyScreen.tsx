import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mail } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useScreenCapturePrevention } from '@/hooks/useScreenCapturePrevention';
import { requestOtp, verifyOtp, otpErrorMessage } from '@/services/otpAuth';
import { getCustomer } from '@/services/customers';
import { findOwnerForAuthUser } from '@/services/owners';
import { storage } from '@/services/storage';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OtpCodeVerify'>;
type Rt = RouteProp<RootStackParamList, 'OtpCodeVerify'>;

/**
 * Saisie du code OTP 6 chiffres reçu par email.
 *
 * Après vérification réussie :
 *  - Si un customer existe déjà pour cet email → ClientTabs
 *  - Sinon → ClientName (création de profil minimal)
 *
 * Note : contrairement au flow phone-OTP, on NE lookup PAS par email pour
 * l'instant (`findCustomerByEmail` n'existe pas). On utilise l'uid Firebase
 * comme customerId, ce qui est le comportement par défaut du reste de l'app.
 */
export function OtpCodeVerifyScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { email, role = 'client' } = route.params;
  const { setOwnerId, setMode } = useApp();
  const { t } = useT();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [error, setError] = useState<string | null>(null);
  useScreenCapturePrevention();

  // Décompte du cooldown de renvoi (60s). Réinitialisé à chaque renvoi.
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    cooldownRef.current = setInterval(() => {
      setResendCooldown((n) => (n > 0 ? n - 1 : 0));
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleVerify = async () => {
    const clean = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(clean)) {
      setError(otpErrorMessage('invalid_code', t));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await verifyOtp(email, clean);
      if (!result.ok) {
        setError(otpErrorMessage(result.error ?? 'internal_error', t));
        return;
      }
      const user = result.user!;

      // ─── Routing selon role ────────────────────────────────
      if (role === 'owner') {
        // Lookup du doc owner correspondant à l'UID authentifié.
        // Si absent, on reste sur l'écran avec un message clair : l'utilisateur
        // s'est authentifié mais n'a pas (encore) de doc owner provisionné
        // par l'admin — il doit contacter Trimya.
        const owner = await findOwnerForAuthUser(user);
        if (!owner) {
          setError(t('auth.otpCode.ownerNotActive'));
          return;
        }
        await setMode('owner');
        await setOwnerId(owner.id);
        nav.reset({ index: 0, routes: [{ name: 'OwnerTabs' }] });
        return;
      }

      // ─── Role client ───────────────────────────────────────
      // Depuis le flow OTP par email, l'uid Firebase est stable (le même
      // email → le même uid à chaque signin). On lookup donc le customer par
      // uid, PAS par phone (qui est vide avec notre flow email). Si le doc
      // existe → ClientTabs. Sinon → ClientName pour renseigner le profil.
      await storage.setCustomerId(user.uid);
      try {
        const existing = await getCustomer(user.uid);
        if (existing) {
          nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
          return;
        }
      } catch {
        // getCustomer peut throw si le doc n'existe pas (permission denied
        // dans certaines configs). On traite ça comme "pas de compte" et on
        // tombe sur ClientName.
      }
      nav.replace('ClientName');
    } catch (e: any) {
      setError(otpErrorMessage('internal_error', t));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      const result = await requestOtp(email, role);
      if (!result.ok) {
        Alert.alert(
          t('common.error'),
          otpErrorMessage(result.error ?? 'internal_error', t),
        );
        return;
      }
      setResendCooldown(60);
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Mail color={colors.primary} size={32} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>{t('auth.otpCode.title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.otpCode.subtitle')}{' '}
          <Text style={styles.email}>{email}</Text>
        </Text>
      </View>

      <TextField
        label={t('auth.otpCode.label')}
        placeholder="123456"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={t('auth.otpCode.verify')}
        onPress={handleVerify}
        loading={loading}
        disabled={code.length < 6}
      />

      <View style={{ height: spacing.md }} />
      <Button
        label={
          resendCooldown > 0
            ? t('auth.otpCode.resendIn', { seconds: resendCooldown })
            : t('auth.otpCode.resend')
        }
        onPress={handleResend}
        loading={resending}
        variant="ghost"
        disabled={resendCooldown > 0}
      />
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
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  email: {
    color: colors.text,
    fontWeight: '600',
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

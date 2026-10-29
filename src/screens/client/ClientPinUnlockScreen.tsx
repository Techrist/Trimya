import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Lock } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { verifyPin, clearPin } from '@/services/clientPin';
import { useScreenCapturePrevention } from '@/hooks/useScreenCapturePrevention';
import { signOut } from '@/services/auth';
import { storage } from '@/services/storage';
import { useApp } from '@/contexts/AppContext';
import { navigateToRoot } from '@/navigation/navigateToRoot';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientPinUnlock'>;

/**
 * Écran de déverrouillage par PIN affiché au démarrage de Trimya Client si
 * un PIN a été configuré dans le profil.
 *
 * Comportement :
 *  - 6 chiffres → verifyPin
 *  - Si OK : `nav.reset` vers ClientTabs
 *  - Si faux : message + compte restant
 *  - Si lock (3 essais ratés) : message countdown 5 min
 *  - Bouton « J'ai oublié mon PIN » → wipe + retour à PhoneSignup (re-auth SMS)
 */
export function ClientPinUnlockScreen() {
  const nav = useNavigation<Nav>();
  const { clearMode } = useApp();
  const { t } = useT();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState<number>(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Bloque les captures d'écran le temps que l'écran est affiché.
  useScreenCapturePrevention();

  // Refresh countdown if locked
  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockUntil]);

  const locked = lockUntil > now;
  const secondsLeft = locked ? Math.ceil((lockUntil - now) / 1000) : 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const handleVerify = async () => {
    if (pin.length !== 6) return;
    setLoading(true);
    try {
      const result = await verifyPin(pin);
      if (result.kind === 'ok') {
        // Reset toute la stack vers ClientTabs
        nav.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'ClientTabs' as string }],
          }),
        );
      } else if (result.kind === 'wrong') {
        setAttemptsLeft(result.attemptsLeft);
        setPin('');
      } else if (result.kind === 'locked') {
        setLockUntil(result.lockUntil);
        setPin('');
        setAttemptsLeft(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    // L'utilisateur ne se rappelle plus du PIN : on le supprime + reset
    // de la session pour qu'il refasse le flow SMS OTP standard.
    await clearPin();
    await signOut();
    await storage.resetAll();
    await clearMode();
    navigateToRoot(nav);
  };

  return (
    <Screen padded centered>
      <View style={styles.header}>
        <Logo size={64} />
        <View style={styles.iconCircle}>
          <Lock color={colors.primary} size={24} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>{t('client.pinUnlock.title')}</Text>
        <Text style={styles.subtitle}>
          {locked
            ? t('client.pinUnlock.lockedHint', {
                minutes: String(minutes).padStart(2, '0'),
                seconds: String(seconds).padStart(2, '0'),
              })
            : t('client.pinUnlock.subtitle')}
        </Text>
      </View>

      <TextField
        label={t('client.pinUnlock.field')}
        placeholder="••••••"
        value={pin}
        onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
        editable={!locked}
      />

      {attemptsLeft !== null && attemptsLeft > 0 ? (
        <Text style={styles.warningText}>
          {t('client.pinUnlock.attemptsLeft', { count: attemptsLeft })}
        </Text>
      ) : null}

      <Button
        label={t('client.pinUnlock.unlockCta')}
        onPress={handleVerify}
        loading={loading}
        disabled={pin.length !== 6 || locked}
      />

      <View style={{ height: spacing.lg }} />

      <Pressable onPress={handleForgot} hitSlop={12}>
        <Text style={styles.forgotText}>
          {t('client.pinUnlock.forgot')}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
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
  warningText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginVertical: spacing.sm,
    fontWeight: '700',
  },
  forgotText: {
    ...typography.caption,
    color: colors.textDim,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});

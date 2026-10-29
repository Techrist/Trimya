import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { LegalLinks } from '@/components/LegalLinks';
import { humanizeError } from '@/lib/humanizeError';
import { navigateToRoot } from '@/navigation/navigateToRoot';
import { activateSalonByCode, registerSalonKioskUid } from '@/services/salons';
import { signInAsSalonKiosk, currentUser } from '@/services/auth';
import { registerSalonKioskPushToken } from '@/services/push';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SalonActivation'>;

export function SalonActivationScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { setSalonId, clearMode } = useApp();

  const handleActivate = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      Alert.alert(t('salon.activation.codeTooShort'), t('salon.activation.codeTooShortHint'));
      return;
    }
    setLoading(true);
    try {
      // 1) Sign-in anonyme : crée un UID Firebase pour ce device kiosque.
      await signInAsSalonKiosk();
      // 2) Résolution code → salon (lookup-only, ne touche pas aux droits).
      const salon = await activateSalonByCode(trimmed);
      // 3) Cloud Function sécurisée qui valide le code ET ajoute le UID
      //    aux kioskUserIds en transaction atomique. Avant on faisait un
      //    updateDoc direct côté client — c'était une faille critique :
      //    n'importe qui pouvait s'auto-déclarer kiosque d'un salon.
      await registerSalonKioskUid(salon.id, trimmed);
      await setSalonId(salon.id);
      registerSalonKioskPushToken(salon.id);
      nav.reset({ index: 0, routes: [{ name: 'SalonTabs' }] });
    } catch (e: any) {
      Alert.alert(t('salon.activation.failed'), humanizeError(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <View style={styles.header}>
        <Logo size={72} />
        <Text style={styles.title}>{t('salon.activation.title')}</Text>
        <Text style={styles.subtitle}>{t('salon.activation.subtitle')}</Text>
      </View>

      <TextField
        label={t('salon.activation.codeLabel')}
        placeholder={t('salon.activation.codePlaceholder')}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <Button label={t('salon.activation.activate')} onPress={handleActivate} loading={loading} />

      <Button
        label={t('salon.activation.notSalon')}
        onPress={async () => {
          await clearMode();
          // En Trimya Pro, retour à ProRoleSelection (salon vs owner).
          navigateToRoot(nav);
        }}
        variant="ghost"
      />

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
});

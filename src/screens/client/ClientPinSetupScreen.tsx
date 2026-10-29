import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useScreenCapturePrevention } from '@/hooks/useScreenCapturePrevention';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Lock, ShieldCheck } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { hasPin, setPin, clearPin } from '@/services/clientPin';
import { useT } from '@/i18n';
import { humanizeError } from '@/lib/humanizeError';
import { colors, radius, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientPinSetup'>;

/**
 * Écran de configuration du PIN 6 chiffres :
 *  - Si pas de PIN → saisir 2 fois pour confirmer
 *  - Si PIN déjà actif → bouton « Supprimer le PIN » et / ou option de
 *    le changer (re-saisir l'ancien puis le nouveau, mais on simplifie
 *    en V1 : on remplace directement après confirmation)
 */
export function ClientPinSetupScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [pinExists, setPinExists] = useState(false);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [saving, setSaving] = useState(false);
  useScreenCapturePrevention();

  useEffect(() => {
    hasPin().then(setPinExists);
  }, []);

  const handleSave = async () => {
    if (pin1.length !== 6 || !/^\d{6}$/.test(pin1)) {
      Alert.alert(t('common.error'), t('client.pin.invalidFormat'));
      return;
    }
    if (pin1 !== pin2) {
      Alert.alert(t('common.error'), t('client.pin.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await setPin(pin1);
      Alert.alert(
        t('client.pin.savedTitle'),
        t('client.pin.savedText'),
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), humanizeError(e, t));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      t('client.pin.removeTitle'),
      t('client.pin.removeText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('client.pin.removeCta'),
          style: 'destructive',
          onPress: async () => {
            await clearPin();
            setPinExists(false);
            Alert.alert(
              t('client.pin.removedTitle'),
              t('client.pin.removedText'),
              [{ text: 'OK', onPress: () => nav.goBack() }],
            );
          },
        },
      ],
    );
  };

  return (
    <Screen padded keyboardAvoiding>
      <Pressable
        onPress={() => nav.goBack()}
        hitSlop={12}
        style={styles.backBtn}
      >
        <ChevronLeft color={colors.textMuted} size={22} strokeWidth={2.2} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Lock color={colors.primary} size={32} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>
          {pinExists ? t('client.pin.titleManage') : t('client.pin.titleSetup')}
        </Text>
        <Text style={styles.subtitle}>
          {pinExists ? t('client.pin.subtitleManage') : t('client.pin.subtitleSetup')}
        </Text>
      </View>

      {pinExists ? (
        <View style={styles.statusCard}>
          <ShieldCheck color={colors.success} size={22} strokeWidth={2.2} />
          <Text style={styles.statusText}>
            {t('client.pin.statusActive')}
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>
        {pinExists ? t('client.pin.changeLabel') : t('client.pin.newPinLabel')}
      </Text>

      <TextField
        label={t('client.pin.field1')}
        placeholder="••••••"
        value={pin1}
        onChangeText={(v) => setPin1(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
      />

      <TextField
        label={t('client.pin.field2')}
        placeholder="••••••"
        value={pin2}
        onChangeText={(v) => setPin2(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
      />

      <Button
        label={pinExists ? t('client.pin.savedCta') : t('client.pin.createCta')}
        onPress={handleSave}
        loading={saving}
        disabled={pin1.length !== 6 || pin2.length !== 6}
      />

      {pinExists ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={t('client.pin.removeCta')}
            onPress={handleClear}
            variant="ghost"
          />
        </View>
      ) : null}

      <Text style={styles.legal}>{t('client.pin.legalHint')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.textMuted,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    marginBottom: spacing.md,
  },
  statusText: {
    ...typography.bodyBold,
    color: colors.success,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  legal: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

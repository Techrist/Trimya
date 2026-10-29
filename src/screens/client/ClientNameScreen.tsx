import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { LegalLinks } from '@/components/LegalLinks';
import { humanizeError } from '@/lib/humanizeError';
import { createCustomer } from '@/services/customers';
import { currentUser } from '@/services/auth';
import { storage } from '@/services/storage';
import { ensureNotificationPermission } from '@/services/notifications';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientName'>;

const DEFAULT_SALON_ID = process.env.EXPO_PUBLIC_DEFAULT_SALON_ID || 'default-salon';

/**
 * Dernier écran de l'inscription client. Collecte les informations
 * personnelles minimales avant de créer le document `customers/{uid}` :
 *
 *  - Prénom    : OBLIGATOIRE, ≥ 2 caractères (affiché partout dans l'app)
 *  - Nom       : optionnel (pour récépissés, fiche client)
 *  - Email     : optionnel, validé si rempli (récupération de compte)
 *
 * Le téléphone provient déjà de Firebase Auth (étape OtpVerify précédente).
 * On évite de demander la date de naissance ici pour ne pas alourdir
 * l'inscription — elle peut être ajoutée plus tard depuis le profil.
 */
export function ClientNameScreen() {
  const nav = useNavigation<Nav>();
  const { t } = useT();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidEmail = (v: string) =>
    v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleContinue = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (trimmedFirst.length < 2) {
      Alert.alert(t('auth.name.tooShort'), t('auth.name.tooShortHint'));
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert(t('common.error'), t('auth.signup.emailInvalid'));
      return;
    }

    setLoading(true);
    try {
      const user = currentUser();
      if (!user) throw new Error('Session expirée.');
      await createCustomer({
        id: user.uid,
        phone: user.phoneNumber || '',
        name: trimmedFirst,
        lastName: trimmedLast || undefined,
        email: trimmedEmail || undefined,
        salonId: DEFAULT_SALON_ID,
      });
      await storage.setCustomerId(user.uid);
      await ensureNotificationPermission();
      nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
    } catch (e: any) {
      Alert.alert(t('common.error'), humanizeError(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded keyboardAvoiding>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.name.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.name.subtitle')}</Text>
        </View>

        <TextField
          label={t('auth.signup.firstName')}
          placeholder={t('auth.signup.firstNamePlaceholder')}
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
        />

        <TextField
          label={t('auth.signup.lastName')}
          placeholder={t('auth.signup.lastNamePlaceholder')}
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
        />
        <Text style={styles.optionalHint}>
          {t('auth.signup.optionalHint')}
        </Text>

        <TextField
          label={t('auth.signup.email')}
          placeholder={t('auth.signup.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Text style={styles.optionalHint}>
          {t('auth.signup.emailHint')}
        </Text>

        <View style={styles.submitWrap}>
          <Button
            label={t('auth.signup.createAccount')}
            onPress={handleContinue}
            loading={loading}
            disabled={firstName.trim().length < 2}
          />
        </View>

        <Text style={styles.legal}>{t('auth.signup.editableLater')}</Text>

        <LegalLinks variant="inline" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  optionalHint: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    fontStyle: 'italic',
  },
  submitWrap: {
    marginTop: spacing.lg,
  },
  legal: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

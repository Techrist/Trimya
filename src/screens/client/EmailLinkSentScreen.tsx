import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mail, CheckCircle2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { humanizeError } from '@/lib/humanizeError';
import { sendMagicLink, clearMagicLinkPending } from '@/services/emailAuth';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EmailLinkSent'>;
type Rt = RouteProp<RootStackParamList, 'EmailLinkSent'>;

/**
 * Écran de confirmation : le magic link a été envoyé, l'utilisateur doit
 * maintenant checker sa boîte email.
 *
 * Deux actions possibles :
 *  - Renvoyer le lien (en cas de perte)
 *  - Changer d'email (retour au PhoneSignup/EmailSignup)
 *
 * La connexion elle-même se fait au clic sur le lien — ce qui déclenche une
 * ouverture de la PWA à une URL spéciale, interceptée au boot par
 * RootNavigator qui route vers ClientTabs ou ClientName selon si c'est un
 * nouveau compte ou un retour.
 */
export function EmailLinkSentScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { email } = route.params;
  const { t } = useT();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await sendMagicLink(email, 'client');
      setResent(true);
    } catch (e: any) {
      Alert.alert(t('common.error'), humanizeError(e, t));
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = () => {
    clearMagicLinkPending();
    nav.goBack();
  };

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

      <View style={styles.hints}>
        <View style={styles.hintRow}>
          <CheckCircle2 color={colors.textMuted} size={16} />
          <Text style={styles.hintText}>{t('auth.emailSent.hint1')}</Text>
        </View>
        <View style={styles.hintRow}>
          <CheckCircle2 color={colors.textMuted} size={16} />
          <Text style={styles.hintText}>{t('auth.emailSent.hint2')}</Text>
        </View>
        <View style={styles.hintRow}>
          <CheckCircle2 color={colors.textMuted} size={16} />
          <Text style={styles.hintText}>{t('auth.emailSent.hint3')}</Text>
        </View>
      </View>

      {resent ? (
        <View style={styles.resentBox}>
          <Text style={styles.resentText}>{t('auth.emailSent.resent')}</Text>
        </View>
      ) : (
        <Button
          label={t('auth.emailSent.resend')}
          onPress={handleResend}
          loading={resending}
          variant="secondary"
        />
      )}

      <View style={{ height: spacing.sm }} />
      <Button
        label={t('auth.emailSent.changeEmail')}
        onPress={handleChangeEmail}
        variant="ghost"
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
  hints: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hintText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
  },
  resentBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  resentText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
});

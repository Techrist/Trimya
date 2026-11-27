import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Clock, XCircle, CheckCircle2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { auth } from '@/services/firebase';
import { signOut } from '@/services/auth';
import { resolveDestination, subscribeAccount, type Account } from '@/services/account';
import { navigateToRoot } from '@/navigation/navigateToRoot';
import { useAccountNavigation } from '@/hooks/useAccountNavigation';
import { useApp } from '@/contexts/AppContext';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

/**
 * État de la demande de compte. Suit `accounts/{uid}` en temps réel :
 *  - pending  : « en cours d'examen » (se met à jour tout seul)
 *  - rejected : motif + contact
 *  - active   : ouvre automatiquement l'espace salon / propriétaire
 */
export function AccountPendingScreen() {
  const nav = useNavigation();
  const { t } = useT();
  const { clearMode } = useApp();
  const goTo = useAccountNavigation();

  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'AccountSignIn' }] }));
      return;
    }
    return subscribeAccount(user.uid, setAccount);
  }, [user, nav]);

  // Connecté (ex. via Google) mais sans demande : on propose de la faire.
  useEffect(() => {
    if (user && account === null) {
      nav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'AccountSignUp', params: { social: true } }],
        }),
      );
    }
  }, [account, user, nav]);

  // Demande validée → on ouvre l'espace correspondant.
  useEffect(() => {
    if (!user || !account || account.status !== 'active') return;
    resolveDestination(user)
      .then(goTo)
      .catch(() => undefined);
  }, [account, user, goTo]);

  const logout = async () => {
    await signOut().catch(() => undefined);
    await clearMode();
    navigateToRoot(nav);
  };

  if (account === undefined || account === null) {
    return (
      <Screen centered>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  const rejected = account?.status === 'rejected';
  const approved = account?.status === 'active';

  return (
    <Screen padded>
      <View style={styles.header}>
        <Logo size={72} />
        {approved ? (
          <CheckCircle2 color={colors.success} size={56} strokeWidth={2} style={styles.icon} />
        ) : rejected ? (
          <XCircle color={colors.danger} size={56} strokeWidth={2} style={styles.icon} />
        ) : (
          <Clock color={colors.primary} size={56} strokeWidth={2} style={styles.icon} />
        )}
        <Text style={styles.title}>
          {approved
            ? t('account.pending.approved')
            : rejected
              ? t('account.pending.rejectedTitle')
              : t('account.pending.title')}
        </Text>
        <Text style={styles.subtitle}>
          {rejected
            ? t('account.pending.rejectedText')
            : approved
              ? ''
              : t('account.pending.text')}
        </Text>
        {rejected && account?.rejectionReason ? (
          <Text style={styles.reason}>
            {t('account.pending.reason', { reason: account.rejectionReason })}
          </Text>
        ) : null}
      </View>

      {rejected ? (
        <Button
          label={t('account.pending.contact')}
          onPress={() => Linking.openURL('mailto:contact@trimya.app').catch(() => undefined)}
        />
      ) : null}
      <Button label={t('account.pending.signOut')} onPress={logout} variant="ghost" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  icon: { marginTop: spacing.lg },
  title: { ...typography.h1, color: colors.text, textAlign: 'center', marginTop: spacing.md },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  reason: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { GoogleLogo } from './GoogleLogo';
import { socialSignInAvailable } from '@/services/socialAuth';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

interface Props {
  onGoogle: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * « Continuer avec Google » + séparateur « ou », placé sous le formulaire
 * email / mot de passe. Masqué quand la connexion sociale n'est pas
 * disponible (apps natives, pour l'instant).
 */
export function SocialAuthBlock({ onGoogle, loading, disabled }: Props) {
  const { t } = useT();
  if (!socialSignInAvailable) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.or}>{t('account.social.or')}</Text>
        <View style={styles.line} />
      </View>
      <Button
        label={t('account.social.google')}
        onPress={onGoogle}
        variant="secondary"
        icon={<GoogleLogo size={20} />}
        loading={loading}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: {
    ...typography.caption,
    color: colors.textDim,
    marginHorizontal: spacing.sm,
    textTransform: 'uppercase',
  },
});

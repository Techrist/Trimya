import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { isProApp } from '@/lib/appTarget';
import { LEGAL_URLS } from '@/lib/legal';
import { openLegalUrl } from '@/components/LegalLinks';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Case de consentement explicite aux conditions d'utilisation et à la
 * politique de confidentialité (jamais cochée d'avance).
 *
 * Le texte contient les liens vers les deux documents ; toucher un lien
 * l'ouvre sans cocher la case, toucher le reste du texte ou la case la
 * coche. L'écran qui l'utilise doit empêcher la validation tant que la
 * case n'est pas cochée et enregistrer la preuve (date + version).
 */
export function ConsentCheckbox({ checked, onChange }: Props) {
  const { t } = useT();
  const cguUrl = isProApp() ? LEGAL_URLS.cguPro : LEGAL_URLS.cguClient;
  const cguLabel = isProApp() ? t('legal.cguPro') : t('legal.cguClient');

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={t('consent.terms.a11y')}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? (
          <Check color={colors.black} size={16} strokeWidth={3.2} />
        ) : null}
      </View>
      <Text style={styles.text}>
        {t('consent.terms.prefix')}{' '}
        <Text style={styles.link} onPress={() => openLegalUrl(cguUrl, t)}>
          {cguLabel}
        </Text>
        {t('consent.terms.and')}
        <Text
          style={styles.link}
          onPress={() => openLegalUrl(LEGAL_URLS.privacy, t)}
        >
          {t('legal.privacy')}
        </Text>
        .
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});

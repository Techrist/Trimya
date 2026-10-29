import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { isProApp } from '@/lib/appTarget';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

/**
 * Liens vers les documents légaux (Politique de confidentialité + CGU
 * correspondante à la cible de build) hébergés sur trimya.com.
 *
 * Trois variantes d'affichage :
 *  - `variant='inline'` : phrase compacte avec liens cliquables (signup,
 *    sign-in) — destinée à être placée sous un bouton d'action principal.
 *  - `variant='list'` : liste verticale de liens (profil utilisateur) —
 *    plus visible, pour un accès permanent.
 *  - `variant='footer'` : version très discrète en bas d'écran.
 *
 * RGPD : les liens doivent être accessibles à tout moment (article 12 GDPR).
 * On les expose dans tous les profils ET au moment du consentement initial.
 */

interface Props {
  variant?: 'inline' | 'list' | 'footer';
}

const URLS = {
  privacy: 'https://trimya.com/privacy',
  cguClient: 'https://trimya.com/cgu',
  cguPro: 'https://trimya.com/cgu-pro',
};

async function open(url: string, t: (key: any) => string) {
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) throw new Error('cannot_open');
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      t('legal.openErrorTitle'),
      t('legal.openErrorText'),
    );
  }
}

export function LegalLinks({ variant = 'inline' }: Props) {
  const { t } = useT();
  const cguUrl = isProApp() ? URLS.cguPro : URLS.cguClient;
  const cguLabel = isProApp() ? t('legal.cguPro') : t('legal.cguClient');

  if (variant === 'list') {
    return (
      <View style={styles.list}>
        <LinkRow
          label={t('legal.privacy')}
          onPress={() => open(URLS.privacy, t)}
        />
        <LinkRow label={cguLabel} onPress={() => open(cguUrl, t)} />
      </View>
    );
  }

  if (variant === 'footer') {
    return (
      <View style={styles.footerRow}>
        <Pressable onPress={() => open(URLS.privacy, t)} hitSlop={8}>
          <Text style={styles.footerLink}>{t('legal.privacyShort')}</Text>
        </Pressable>
        <Text style={styles.footerSeparator}>·</Text>
        <Pressable onPress={() => open(cguUrl, t)} hitSlop={8}>
          <Text style={styles.footerLink}>
            {isProApp() ? t('legal.cguProShort') : t('legal.cguClientShort')}
          </Text>
        </Pressable>
      </View>
    );
  }

  // variant === 'inline'
  return (
    <Text style={styles.inlineText}>
      {t('legal.inlinePrefix')}{' '}
      <Text style={styles.inlineLink} onPress={() => open(cguUrl, t)}>
        {cguLabel}
      </Text>
      {t('legal.inlineAnd')}
      <Text style={styles.inlineLink} onPress={() => open(URLS.privacy, t)}>
        {t('legal.privacy')}
      </Text>
      .
    </Text>
  );
}

// ─── Sub-components ────────────────────────────────────────

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.listRow}>
      <Text style={styles.listText}>{label}</Text>
      <Text style={styles.listChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ── variant='inline' ──
  inlineText: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.md,
  },
  inlineLink: {
    ...typography.caption,
    color: colors.primary,
    textDecorationLine: 'underline',
  },

  // ── variant='list' ──
  list: {
    gap: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  listText: {
    ...typography.body,
    color: colors.text,
  },
  listChevron: {
    ...typography.h3,
    color: colors.textDim,
    fontWeight: '400',
  },

  // ── variant='footer' ──
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  footerLink: {
    ...typography.caption,
    color: colors.textDim,
    textDecorationLine: 'underline',
  },
  footerSeparator: {
    ...typography.caption,
    color: colors.textDim,
  },
});

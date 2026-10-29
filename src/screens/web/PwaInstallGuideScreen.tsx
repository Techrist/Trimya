import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { usePwaInstall } from '@/hooks/usePwaInstall';

/**
 * Guide d'installation PWA — s'affiche au premier lancement d'un navigateur
 * tant que l'app n'est pas installée. Trois parcours selon la plateforme :
 *
 *   Android (Chrome, Edge, Samsung) :
 *     → bouton « Installer Trimya » qui déclenche le prompt natif
 *     → fallback : instructions menu ⋮ → « Ajouter à l'écran d'accueil »
 *
 *   iOS Safari :
 *     → pas de prompt possible : on explique en 3 étapes
 *       Partager → « Sur l'écran d'accueil » → « Ajouter »
 *
 *   iOS Chrome (CriOS) :
 *     → message spécial : « L'installation PWA ne marche que depuis Safari.
 *       Ouvrez ce lien dans Safari pour installer Trimya. »
 *
 *   Desktop (bureau) :
 *     → même logique que Android — prompt natif ou menu navigateur
 *
 * Encart spécial kiosque (quand `isKioskMode` est vrai) : check-list des
 * réglages device recommandés (verrouillage auto, caméra, Wi-Fi, Android).
 *
 * Jamais de succès fictif : si le prompt natif est refusé on reste sur
 * le guide manuel ; si l'utilisateur dismiss on respecte son choix.
 */

interface PwaInstallGuideScreenProps {
  /** true = afficher l'encart « réglages kiosque » après le guide normal. */
  isKioskMode?: boolean;
  /** Appelé quand l'utilisateur clique « Plus tard ». */
  onSkip: () => void;
}

export function PwaInstallGuideScreen({
  isKioskMode = false,
  onSkip,
}: PwaInstallGuideScreenProps) {
  const { t } = useT();
  const install = usePwaInstall();
  const [installing, setInstalling] = useState(false);
  const [installOutcome, setInstallOutcome] = useState<
    'accepted' | 'dismissed' | 'unavailable' | null
  >(null);

  const platform = install.info;

  const sections = useMemo(
    () => buildSections(platform, t),
    [platform, t],
  );

  const handleInstall = async () => {
    setInstalling(true);
    const outcome = await install.installNative();
    setInstallOutcome(outcome);
    setInstalling(false);
  };

  const handleDismiss = () => {
    install.dismissGuide();
    onSkip();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('pwa.installGuide.title')}
          </Text>
          <Text style={styles.subtitle}>
            {t('pwa.installGuide.subtitle')}
          </Text>
        </View>

        {/* Bouton install natif si dispo (Chromium Android/Desktop) */}
        {install.canPromptNative && (
          <View style={styles.nativeInstallBox}>
            <Text style={styles.boxTitle}>
              {t('pwa.installGuide.quickInstallTitle')}
            </Text>
            <Text style={styles.boxText}>
              {t('pwa.installGuide.quickInstallText')}
            </Text>
            <Button
              label={t('pwa.installGuide.installButton')}
              onPress={handleInstall}
              loading={installing}
            />
            {installOutcome === 'dismissed' && (
              <Text style={styles.hint}>
                {t('pwa.installGuide.dismissedHint')}
              </Text>
            )}
            {installOutcome === 'accepted' && (
              <Text style={styles.success}>
                {t('pwa.installGuide.acceptedHint')}
              </Text>
            )}
          </View>
        )}

        {/* Steps par plateforme */}
        {sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              </View>
            ))}
            {section.note && (
              <Text style={styles.note}>{section.note}</Text>
            )}
          </View>
        ))}

        {/* Encart kiosque — checklist réglages device */}
        {isKioskMode && (
          <View style={styles.kioskBox}>
            <Text style={styles.boxTitle}>
              {t('pwa.installGuide.kioskTitle')}
            </Text>
            <KioskChecklistItem text={t('pwa.installGuide.kioskLockNever')} />
            <KioskChecklistItem text={t('pwa.installGuide.kioskCameraAllow')} />
            <KioskChecklistItem text={t('pwa.installGuide.kioskWifi')} />
            <KioskChecklistItem text={t('pwa.installGuide.kioskAndroid')} />
          </View>
        )}

        <View style={styles.footer}>
          <Pressable onPress={handleDismiss} hitSlop={10}>
            <Text style={styles.skip}>{t('pwa.installGuide.later')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function KioskChecklistItem({ text }: { text: string }) {
  return (
    <View style={styles.checkItem}>
      <View style={styles.checkbox}>
        <Text style={styles.checkmark}>✓</Text>
      </View>
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

type Section = { title: string; steps: string[]; note?: string };

type Tr = ReturnType<typeof useT>['t'];

function buildSections(platform: ReturnType<typeof usePwaInstall>['info'], t: Tr): Section[] {
  const sections: Section[] = [];

  // Chrome iOS = pas d'install possible, il FAUT Safari
  if (platform.os === 'ios' && platform.browser === 'chrome') {
    sections.push({
      title: t('pwa.installGuide.iosChrome.title'),
      steps: [
        t('pwa.installGuide.iosChrome.step1'),
        t('pwa.installGuide.iosChrome.step2'),
      ],
      note: t('pwa.installGuide.iosChrome.note'),
    });
    return sections;
  }

  if (platform.os === 'ios') {
    sections.push({
      title: t('pwa.installGuide.ios.title'),
      steps: [
        t('pwa.installGuide.ios.step1'),
        t('pwa.installGuide.ios.step2'),
        t('pwa.installGuide.ios.step3'),
      ],
      note: t('pwa.installGuide.ios.note'),
    });
    return sections;
  }

  if (platform.os === 'android') {
    sections.push({
      title: t('pwa.installGuide.android.title'),
      steps: [
        t('pwa.installGuide.android.step1'),
        t('pwa.installGuide.android.step2'),
        t('pwa.installGuide.android.step3'),
      ],
    });
    return sections;
  }

  // Desktop
  sections.push({
    title: t('pwa.installGuide.desktop.title'),
    steps: [
      t('pwa.installGuide.desktop.step1'),
      t('pwa.installGuide.desktop.step2'),
      t('pwa.installGuide.desktop.step3'),
    ],
  });
  return sections;
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  nativeInstallBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  boxTitle: {
    ...typography.h3,
    color: colors.text,
  },
  boxText: {
    ...typography.body,
    color: colors.textMuted,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: '700',
  },
  stepBody: {
    flex: 1,
  },
  stepText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    paddingHorizontal: 48,
  },
  kioskBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  checkItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  success: {
    ...typography.caption,
    color: '#22C55E',
    marginTop: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  skip: {
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});

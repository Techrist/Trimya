import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Scissors, Zap, Bell, LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { useT } from '@/i18n';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { useApp } from '@/contexts/AppContext';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

const BG_PATTERN = require('../../assets/bg-pattern.png');

type Nav = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen() {
  const nav = useNavigation<Nav>();
  const { setOnboarded } = useApp();
  const { t } = useT();

  const handleStart = async () => {
    await setOnboarded();
    nav.replace('RoleSelection');
  };

  return (
    <ImageBackground
      source={BG_PATTERN}
      style={styles.bg}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      <Screen padded transparent>
        <View style={styles.langTopBar}>
          <LanguageSwitch />
        </View>

        <View style={styles.content}>
          <View style={styles.top}>
            <Logo size={140} />
            <Text style={styles.brand}>{t('onboarding.brand')}</Text>
            <Text style={styles.tagline}>{t('onboarding.tagline')}</Text>
          </View>

          <View style={styles.features}>
            <Feature
              Icon={Scissors}
              title={t('onboarding.feature.cuts.title')}
              subtitle={t('onboarding.feature.cuts.subtitle')}
            />
            <Feature
              Icon={Zap}
              title={t('onboarding.feature.fast.title')}
              subtitle={t('onboarding.feature.fast.subtitle')}
            />
            <Feature
              Icon={Bell}
              title={t('onboarding.feature.notif.title')}
              subtitle={t('onboarding.feature.notif.subtitle')}
            />
          </View>

          <View style={styles.cta}>
            <Button label={t('onboarding.cta')} onPress={handleStart} />
          </View>
        </View>
      </Screen>
    </ImageBackground>
  );
}

function Feature({
  Icon,
  title,
  subtitle,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.feature}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featureIconWrap}
      >
        <Icon color={colors.black} size={24} strokeWidth={2.5} />
      </LinearGradient>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bgImage: {
    // Légère opacité pour que le pattern reste discret et ne perturbe
    // pas la lisibilité du logo et du texte au premier plan.
    opacity: 0.55,
  },
  langTopBar: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  top: {
    alignItems: 'center',
  },
  brand: {
    ...typography.display,
    color: colors.text,
    marginTop: spacing.md,
    letterSpacing: 4,
    textAlign: 'center',
  },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  features: {
    width: '100%',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  featureSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  cta: {
    width: '100%',
  },
});

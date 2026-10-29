import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Scissors, Crown, ArrowRight, LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';
import { Logo } from '@/components/Logo';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { useApp } from '@/contexts/AppContext';
import { colors, radius, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProRoleSelection'>;

/**
 * Écran de sélection de rôle pour l'app Trimya Pro (B2B).
 *
 * Deux choix uniquement :
 *  - Activer un salon (mode kiosque tablette) → SalonActivation
 *  - Se connecter en tant que propriétaire     → OwnerSignIn
 *
 * Le mode `client` n'existe pas dans Trimya Pro : un client utilisant cette
 * app par erreur doit être renvoyé vers Trimya (B2C). Un lien discret en bas
 * de l'écran l'oriente vers le téléchargement.
 */
export function ProRoleSelectionScreen() {
  const nav = useNavigation<Nav>();
  const { setMode } = useApp();
  const { t } = useT();

  const choose = async (role: 'salon' | 'owner') => {
    await setMode(role);
    if (role === 'salon') nav.replace('SalonActivation');
    else nav.replace('OwnerSignIn');
  };

  return (
    <Screen padded>
      <View style={styles.langTopBar}>
        <LanguageSwitch />
      </View>

      <View style={styles.header}>
        <Logo size={64} />
        <Text style={styles.title}>{t('proRole.title')}</Text>
        <Text style={styles.subtitle}>{t('proRole.subtitle')}</Text>
      </View>

      <View style={styles.options}>
        <RoleCard
          Icon={Scissors}
          title={t('proRole.salon.title')}
          subtitle={t('proRole.salon.subtitle')}
          onPress={() => choose('salon')}
          highlight
        />
        <RoleCard
          Icon={Crown}
          title={t('proRole.owner.title')}
          subtitle={t('proRole.owner.subtitle')}
          onPress={() => choose('owner')}
        />
      </View>

      <Text style={styles.warn}>{t('proRole.warning')}</Text>

      <View style={{ flex: 1 }} />

      {/* Lien discret : un client qui se serait trompé d'app est renvoyé
          vers l'app Trimya (B2C) sur les stores. */}
      <Text style={styles.clientHint}>{t('proRole.clientHint')}</Text>
    </Screen>
  );
}

function RoleCard({
  Icon,
  title,
  subtitle,
  onPress,
  highlight,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  const tone = highlight ? colors.black : colors.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <LinearGradient
        colors={
          highlight
            ? [colors.gradientStart, colors.gradientEnd]
            : [colors.surface, colors.surface]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, !highlight && styles.cardBordered]}
      >
        <View style={[styles.iconCircle, highlight && styles.iconCircleHighlight]}>
          <Icon
            color={highlight ? colors.black : colors.primary}
            size={26}
            strokeWidth={2.2}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, highlight && styles.cardTitleDark]}>
            {title}
          </Text>
          <Text style={[styles.cardSubtitle, highlight && styles.cardSubtitleDark]}>
            {subtitle}
          </Text>
        </View>
        <ArrowRight color={tone} size={22} strokeWidth={2.2} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  langTopBar: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  options: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  cardBordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  iconCircleHighlight: {
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
  },
  cardTitleDark: { color: colors.black },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardSubtitleDark: { color: '#1a1a1a' },
  warn: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  clientHint: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    paddingBottom: spacing.md,
    fontStyle: 'italic',
  },
});

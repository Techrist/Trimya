import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Scissors, ArrowRight, LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';
import { Logo } from '@/components/Logo';
import { useApp } from '@/contexts/AppContext';
import { colors, radius, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RoleSelection'>;

export function RoleSelectionScreen() {
  const nav = useNavigation<Nav>();
  const { setMode } = useApp();
  const { t } = useT();

  const choose = async (role: 'client' | 'salon') => {
    await setMode(role);
    if (role === 'client') nav.replace('PhoneSignup');
    else nav.replace('SalonActivation');
  };

  return (
    <Screen padded>
      <View style={styles.header}>
        <Logo size={64} />
        <Text style={styles.title}>{t('role.title')}</Text>
        <Text style={styles.subtitle}>{t('role.subtitle')}</Text>
      </View>

      <View style={styles.options}>
        <RoleCard
          Icon={User}
          title={t('role.client.title')}
          subtitle={t('role.client.subtitle')}
          onPress={() => choose('client')}
          highlight
        />
        <RoleCard
          Icon={Scissors}
          title={t('role.salon.title')}
          subtitle={t('role.salon.subtitle')}
          onPress={() => choose('salon')}
        />
      </View>

      <Text style={styles.warn}>{t('role.warning')}</Text>
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
    marginTop: spacing.xl,
  },
});

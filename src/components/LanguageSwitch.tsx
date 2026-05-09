import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { useT, SUPPORTED_LOCALES, Locale } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

interface LanguageSwitchProps {
  style?: ViewStyle;
}

/**
 * Compact inline language switcher — designed to live in headers /
 * landing pages where the full LanguagePicker card would feel heavy.
 */
export function LanguageSwitch({ style }: LanguageSwitchProps) {
  const { locale, setLocale } = useT();

  return (
    <View style={[styles.row, style]}>
      {SUPPORTED_LOCALES.map((opt) => {
        const active = locale === opt.code;
        return (
          <Pressable
            key={opt.code}
            onPress={() => setLocale(opt.code as Locale)}
            style={[styles.chip, active && styles.chipActive]}
            hitSlop={6}
          >
            <Text style={styles.flag}>{opt.flag}</Text>
            <Text style={[styles.code, active && styles.codeActive]}>
              {opt.code.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-end',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  flag: {
    fontSize: 14,
  },
  code: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  codeActive: {
    color: colors.black,
  },
});

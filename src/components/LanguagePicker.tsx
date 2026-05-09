import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Languages, Check } from 'lucide-react-native';
import { Card } from './Card';
import { useT, SUPPORTED_LOCALES, Locale } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

export function LanguagePicker() {
  const { locale, setLocale, t } = useT();

  return (
    <Card>
      <View style={styles.headerRow}>
        <Languages color={colors.primary} size={20} strokeWidth={2} />
        <Text style={styles.title}>{t('client.profile.language')}</Text>
      </View>
      <View style={styles.options}>
        {SUPPORTED_LOCALES.map((opt) => {
          const active = locale === opt.code;
          return (
            <Pressable
              key={opt.code}
              onPress={() => setLocale(opt.code as Locale)}
              style={[styles.option, active && styles.optionActive]}
            >
              <Text style={styles.flag}>{opt.flag}</Text>
              <Text
                style={[styles.optionLabel, active && styles.optionLabelActive]}
              >
                {opt.label}
              </Text>
              {active && (
                <Check color={colors.primary} size={18} strokeWidth={2.4} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  flag: {
    fontSize: 22,
  },
  optionLabel: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  optionLabelActive: {
    color: colors.primary,
  },
});

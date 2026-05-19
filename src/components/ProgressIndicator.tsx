import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography, REWARD_THRESHOLD } from '@/theme';
import { useT } from '@/i18n';

interface ProgressIndicatorProps {
  count: number;
  threshold?: number;
}

export function ProgressIndicator({
  count,
  threshold = REWARD_THRESHOLD,
}: ProgressIndicatorProps) {
  const { t } = useT();
  const isReady = count >= threshold;
  const remaining = threshold - count;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {isReady ? t('progress.rewardReady') : t('progress.label')}
      </Text>

      <View style={styles.dotsRow}>
        {Array.from({ length: threshold }).map((_, i) => {
          const filled = i < count;
          return filled ? (
            <LinearGradient
              key={i}
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dot}
            />
          ) : (
            <View key={i} style={[styles.dot, styles.dotEmpty]} />
          );
        })}
      </View>

      <Text style={styles.countText}>
        <Text style={styles.countBig}>{Math.min(count, threshold)}</Text>
        <Text style={styles.countSmall}>/{threshold}</Text>
      </Text>

      {!isReady && (
        <Text style={styles.hint}>
          {t(remaining > 1 ? 'progress.hintPlural' : 'progress.hint', { count: remaining })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    // Padding vertical réduit pour que la carte tienne sans scroll sur
    // les petits téléphones (le compteur est visuellement explicite,
    // pas besoin de respirer autant).
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.border,
  },
  countText: {
    marginTop: 0,
  },
  countBig: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  countSmall: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

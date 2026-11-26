import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface Props {
  /** Texte neutre, ex. « Pas encore de compte ? » */
  text: string;
  /** Lien cliquable, ex. « S'inscrire » */
  linkText: string;
  onPress: () => void;
}

/** Pied de page d'écran d'auth : « Pas encore de compte ? S'inscrire ». */
export function AuthFooterLink({ text, linkText, onPress }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{text} </Text>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
        <Text style={styles.link}>{linkText}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  text: { ...typography.body, color: colors.textMuted },
  link: { ...typography.body, color: colors.primary, fontWeight: '700' },
});

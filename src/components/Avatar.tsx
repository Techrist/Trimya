import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography } from '@/theme';

interface AvatarProps {
  name?: string;
  photo?: string;
  size?: number;
  style?: ViewStyle;
}

/**
 * Generic photo avatar with first-letter fallback.
 * Used for clients, salons, barbers — any entity with an optional photo.
 */
export function Avatar({ name, photo, size = 48, style }: AvatarProps) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700',
  },
});

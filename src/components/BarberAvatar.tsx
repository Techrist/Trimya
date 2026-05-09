import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography } from '@/theme';
import { Barber } from '@/types';

interface BarberAvatarProps {
  barber: Pick<Barber, 'name' | 'photo'>;
  size?: number;
  style?: ViewStyle;
}

export function BarberAvatar({ barber, size = 48, style }: BarberAvatarProps) {
  const initial = (barber.name || '?').charAt(0).toUpperCase();
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {barber.photo ? (
        <Image
          source={{ uri: barber.photo }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text
          style={[
            styles.initial,
            { fontSize: size * 0.4 },
          ]}
        >
          {initial}
        </Text>
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
